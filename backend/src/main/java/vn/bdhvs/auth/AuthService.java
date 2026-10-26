package vn.bdhvs.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.bdhvs.auth.AuthDtos.RegisterRequest;
import vn.bdhvs.auth.AuthDtos.ResetTokenResponse;
import vn.bdhvs.auth.AuthDtos.UserSummary;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.mail.MailService;
import vn.bdhvs.common.util.Db;
import vn.bdhvs.common.util.Secrets;
import vn.bdhvs.common.util.Texts;

@Service
public class AuthService {

    private static final int MAX_FAILED_LOGIN = 5;
    private static final Duration TEMP_LOCK = Duration.ofMinutes(15);
    private static final Duration RESET_TOKEN_TTL = Duration.ofMinutes(10);

    private final JdbcClient db;
    private final PasswordEncoder encoder;
    private final OtpService otp;
    private final MailService mail;
    private final RefreshTokenService refreshTokens;
    /** Băm giả để thời gian phản hồi như nhau dù email có tồn tại hay không. */
    private final String dummyHash;

    public AuthService(JdbcClient db, PasswordEncoder encoder, OtpService otp, MailService mail,
            RefreshTokenService refreshTokens) {
        this.db = db;
        this.encoder = encoder;
        this.otp = otp;
        this.mail = mail;
        this.refreshTokens = refreshTokens;
        this.dummyHash = encoder.encode("dummy-password-0");
    }

    record UserRow(long id, String email, String fullName, String passwordHash, String status,
            int failedLoginCount, Instant lockedUntil, String avatarUrl) {
    }

    private UserRow findByEmail(String email) {
        return db.sql("""
                SELECT id, email, full_name, password_hash, status, failed_login_count, locked_until, avatar_url
                FROM dbo.users WHERE email = :email AND deleted_at IS NULL""")
                .param("email", Texts.normalizeEmail(email)).query(UserRow.class).optional().orElse(null);
    }

    /** FR-AUTH-01 */
    @Transactional
    public void register(RegisterRequest r, String ip) {
        String email = Texts.normalizeEmail(r.email());
        if (!r.password().equals(r.confirmPassword())) {
            throw ApiException.validation("confirmPassword", "Mật khẩu xác nhận không khớp");
        }
        PasswordPolicy.check("password", r.password(), email);
        UserRow existing = findByEmail(email);
        long userId;
        if (existing != null && !"PENDING_VERIFICATION".equals(existing.status())) {
            throw ApiException.conflict("EMAIL_EXISTS", "Email đã được sử dụng");
        }
        if (existing != null) {
            // Email đã đăng ký nhưng chưa xác thực: cập nhật thông tin và gửi OTP mới.
            userId = existing.id();
            db.sql("""
                    UPDATE dbo.users SET full_name = :name, password_hash = :pw, birth_year = :by, hometown = :ht,
                        workplace = :wp, phone = :phone, privacy_consent_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
                    WHERE id = :id""")
                    .param("name", r.fullName().trim()).param("pw", encoder.encode(r.password()))
                    .param("by", r.birthYear()).param("ht", Texts.trimToNull(r.hometown()))
                    .param("wp", Texts.trimToNull(r.workplace())).param("phone", Texts.trimToNull(r.phone()))
                    .param("id", userId).update();
        } else {
            userId = db.sql("""
                    INSERT INTO dbo.users (email, password_hash, full_name, birth_year, hometown, workplace, phone, status, privacy_consent_at)
                    OUTPUT INSERTED.id
                    VALUES (:email, :pw, :name, :by, :ht, :wp, :phone, N'PENDING_VERIFICATION', SYSUTCDATETIME())""")
                    .param("email", email).param("pw", encoder.encode(r.password())).param("name", r.fullName().trim())
                    .param("by", r.birthYear()).param("ht", Texts.trimToNull(r.hometown()))
                    .param("wp", Texts.trimToNull(r.workplace())).param("phone", Texts.trimToNull(r.phone()))
                    .query(Long.class).single();
            db.sql("INSERT INTO dbo.user_roles (user_id, role_id) SELECT :uid, id FROM dbo.roles WHERE code = N'USER'")
                    .param("uid", userId).update();
        }
        otp.issue(userId, email, r.fullName().trim(), "REGISTER", ip);
    }

    /** FR-AUTH-02: OTP đúng → kích hoạt tài khoản. */
    public long verifyRegistration(String email, String code) {
        UserRow u = findByEmail(email);
        if (u == null || !"PENDING_VERIFICATION".equals(u.status())) {
            throw ApiException.unprocessable("OTP_INVALID", "Mã OTP không đúng hoặc tài khoản đã được xác thực");
        }
        otp.verify(u.id(), "REGISTER", code);
        db.sql("""
                UPDATE dbo.users SET status = N'ACTIVE', email_verified_at = SYSUTCDATETIME(), last_login_at = SYSUTCDATETIME(),
                    updated_at = SYSUTCDATETIME() WHERE id = :id""").param("id", u.id()).update();
        return u.id();
    }

    /** FR-AUTH-03 */
    public void resendOtp(String email, String purpose, String ip) {
        UserRow u = findByEmail(email);
        // Không tiết lộ email có tồn tại hay không.
        if (u == null) {
            return;
        }
        if ("REGISTER".equals(purpose) && "PENDING_VERIFICATION".equals(u.status())) {
            otp.issue(u.id(), u.email(), u.fullName(), purpose, ip);
        } else if ("RESET_PASSWORD".equals(purpose) && "ACTIVE".equals(u.status())) {
            otp.issue(u.id(), u.email(), u.fullName(), purpose, ip);
        }
    }

    /** FR-AUTH-04 + BR-AUTH-05. Không chạy trong transaction để bộ đếm sai luôn được ghi. */
    public long login(String email, String password, String ip) {
        UserRow u = findByEmail(email);
        if (u == null) {
            encoder.matches(password, dummyHash);
            throw invalidCredentials();
        }
        if (u.lockedUntil() != null && u.lockedUntil().isAfter(Instant.now())) {
            long minutes = Math.max(1, Duration.between(Instant.now(), u.lockedUntil()).toMinutes() + 1);
            throw ApiException.forbidden("ACCOUNT_LOCKED",
                    "Bạn đã nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau " + minutes + " phút");
        }
        if (!encoder.matches(password, u.passwordHash())) {
            int failed = u.failedLoginCount() + 1;
            boolean lock = failed >= MAX_FAILED_LOGIN;
            db.sql("UPDATE dbo.users SET failed_login_count = :f, locked_until = :until WHERE id = :id")
                    .param("f", lock ? 0 : failed).param("until", lock ? Db.ts(Instant.now().plus(TEMP_LOCK)) : null)
                    .param("id", u.id()).update();
            throw invalidCredentials();
        }
        if ("LOCKED".equals(u.status())) {
            throw ApiException.forbidden("ACCOUNT_LOCKED", "Tài khoản đã bị khóa, vui lòng liên hệ quản trị viên");
        }
        if ("PENDING_VERIFICATION".equals(u.status())) {
            try {
                otp.issue(u.id(), u.email(), u.fullName(), "REGISTER", ip);
            } catch (ApiException ignored) {
                // Mã cũ vẫn còn hiệu lực hoặc đã chạm giới hạn gửi: người dùng vẫn được chuyển sang màn nhập OTP.
            }
            throw ApiException.forbidden("ACCOUNT_NOT_VERIFIED", "Tài khoản chưa xác thực email. Chúng tôi đã gửi mã OTP tới email của bạn");
        }
        db.sql("UPDATE dbo.users SET failed_login_count = 0, locked_until = NULL, last_login_at = SYSUTCDATETIME() WHERE id = :id")
                .param("id", u.id()).update();
        return u.id();
    }

    private static ApiException invalidCredentials() {
        return ApiException.unauthorized("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng");
    }

    /** FR-AUTH-07 bước 1: luôn trả cùng một thông báo để tránh dò email. */
    public void forgotPassword(String email, String ip) {
        UserRow u = findByEmail(email);
        if (u != null && "ACTIVE".equals(u.status())) {
            otp.issue(u.id(), u.email(), u.fullName(), "RESET_PASSWORD", ip);
        }
    }

    /** FR-AUTH-07 bước 2: OTP đúng → resetToken 10 phút. */
    public ResetTokenResponse verifyForgotPassword(String email, String code) {
        UserRow u = findByEmail(email);
        if (u == null || !"ACTIVE".equals(u.status())) {
            throw ApiException.unprocessable("OTP_INVALID", "Mã OTP không đúng");
        }
        otp.verify(u.id(), "RESET_PASSWORD", code);
        String token = Secrets.token();
        db.sql("INSERT INTO dbo.password_reset_tokens (user_id, token_hash, source, expires_at) VALUES (:uid, :hash, N'SELF', :exp)")
                .param("uid", u.id()).param("hash", Secrets.sha256(token))
                .param("exp", Db.ts(Instant.now().plus(RESET_TOKEN_TTL))).update();
        return new ResetTokenResponse(token, RESET_TOKEN_TTL.toSeconds());
    }

    private record ResetRow(long id, long userId, Instant expiresAt, Instant usedAt, String email, String fullName) {
    }

    /** FR-AUTH-07 bước 3, và cũng dùng cho liên kết đặt mật khẩu do Admin gửi (FR-ADM-02). */
    @Transactional
    public void resetPassword(String token, String newPassword) {
        ResetRow t = db.sql("""
                SELECT t.id, t.user_id, t.expires_at, t.used_at, u.email, u.full_name
                FROM dbo.password_reset_tokens t WITH (UPDLOCK) JOIN dbo.users u ON u.id = t.user_id
                WHERE t.token_hash = :hash AND u.deleted_at IS NULL""")
                .param("hash", Secrets.sha256(token)).query(ResetRow.class).optional()
                .filter(r -> r.usedAt() == null && r.expiresAt().isAfter(Instant.now()))
                .orElseThrow(() -> ApiException.unprocessable("RESET_TOKEN_INVALID",
                        "Phiên đặt lại mật khẩu đã hết hạn, vui lòng thực hiện lại"));
        PasswordPolicy.check("newPassword", newPassword, t.email());
        db.sql("UPDATE dbo.password_reset_tokens SET used_at = SYSUTCDATETIME() WHERE id = :id").param("id", t.id()).update();
        // Liên kết từ email chứng minh quyền sở hữu email: tài khoản chưa xác thực cũng được kích hoạt.
        db.sql("""
                UPDATE dbo.users SET password_hash = :pw, failed_login_count = 0, locked_until = NULL,
                    status = CASE WHEN status = N'PENDING_VERIFICATION' THEN N'ACTIVE' ELSE status END,
                    email_verified_at = COALESCE(email_verified_at, SYSUTCDATETIME()), updated_at = SYSUTCDATETIME()
                WHERE id = :id""")
                .param("pw", encoder.encode(newPassword)).param("id", t.userId()).update();
        refreshTokens.revokeAll(t.userId(), "PASSWORD_CHANGED");
        mail.sendPasswordChanged(t.email(), t.fullName());
    }

    public UserSummary summary(long userId) {
        record Row(long id, String fullName, String email, String avatarUrl) {
        }
        Row u = db.sql("SELECT id, full_name, email, avatar_url FROM dbo.users WHERE id = :id")
                .param("id", userId).query(Row.class).single();
        List<String> roles = db.sql("""
                SELECT r.code FROM dbo.user_roles ur JOIN dbo.roles r ON r.id = ur.role_id WHERE ur.user_id = :id""")
                .param("id", userId).query(String.class).list();
        return new UserSummary(u.id(), u.fullName(), u.email(), u.avatarUrl(), roles);
    }
}
