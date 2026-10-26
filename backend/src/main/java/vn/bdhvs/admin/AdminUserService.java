package vn.bdhvs.admin;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import vn.bdhvs.auth.PasswordPolicy;
import vn.bdhvs.auth.RefreshTokenService;
import vn.bdhvs.common.audit.AuditService;
import vn.bdhvs.common.config.AppProperties;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.mail.MailService;
import vn.bdhvs.common.util.Db;
import vn.bdhvs.common.util.Secrets;
import vn.bdhvs.common.util.Texts;
import vn.bdhvs.common.web.PageResponse;

/** Quản lý người dùng: FR-ADM-01..06, BR-ADM-01, BR-AUTH-07. */
@Service
public class AdminUserService {

    private final JdbcClient db;
    private final PasswordEncoder encoder;
    private final RefreshTokenService refreshTokens;
    private final MailService mail;
    private final AuditService audit;
    private final AppProperties props;

    public AdminUserService(JdbcClient db, PasswordEncoder encoder, RefreshTokenService refreshTokens, MailService mail,
            AuditService audit, AppProperties props) {
        this.db = db;
        this.encoder = encoder;
        this.refreshTokens = refreshTokens;
        this.mail = mail;
        this.audit = audit;
        this.props = props;
    }

    public record UserRow(long id, String fullName, String email, String phone, String avatarUrl, String status,
            String roles, Instant createdAt, Instant lastLoginAt, Instant emailVerifiedAt) {
    }

    public record UserEnrollment(long courseId, String courseTitle, String courseSlug, String status, int roundNo,
            int progressPercent, Instant enrolledAt, Instant expiresAt, Instant expiredAt, Instant completedAt,
            BigDecimal totalScore) {
    }

    public record UserDetail(long id, String fullName, String email, Integer birthYear, String hometown, String workplace,
            String phone, String avatarUrl, String status, String lockReason, List<String> roles, Instant createdAt,
            Instant lastLoginAt, Instant emailVerifiedAt, boolean showOnLeaderboard, List<UserEnrollment> enrollments) {
    }

    public record CreateUser(
            @NotBlank @Size(min = 2, max = 100) String fullName,
            @NotBlank @Email @Size(max = 255) String email,
            @Min(1900) @Max(2100) Integer birthYear,
            @Size(max = 255) String hometown,
            @Size(max = 255) String workplace,
            @Pattern(regexp = "^$|^(0|\\+84)[0-9]{9,10}$", message = "Số điện thoại không đúng định dạng") String phone,
            @NotEmpty List<@Pattern(regexp = "ADMIN|USER") String> roles,
            @Pattern(regexp = "ACTIVE|LOCKED") String status,
            @NotBlank @Pattern(regexp = "EMAIL_LINK|TEMP_PASSWORD") String passwordMode,
            String tempPassword) {
    }

    public record UpdateUser(
            @NotBlank @Size(min = 2, max = 100) String fullName,
            @NotBlank @Email @Size(max = 255) String email,
            @Min(1900) @Max(2100) Integer birthYear,
            @Size(max = 255) String hometown,
            @Size(max = 255) String workplace,
            @Pattern(regexp = "^$|^(0|\\+84)[0-9]{9,10}$", message = "Số điện thoại không đúng định dạng") String phone,
            @NotEmpty List<@Pattern(regexp = "ADMIN|USER") String> roles) {
    }

    // ------------------------------------------------------------- danh sách

    public PageResponse<UserRow> list(String q, String role, String status, LocalDate createdFrom, LocalDate createdTo,
            String sort, int page, int size) {
        StringBuilder where = new StringBuilder(" WHERE u.deleted_at IS NULL");
        Map<String, Object> p = new HashMap<>();
        if (q != null && !q.isBlank()) {
            where.append(" AND (u.full_name LIKE :q OR u.email LIKE :q OR u.phone LIKE :q)");
            p.put("q", "%" + q.trim() + "%");
        }
        if (role != null && !role.isBlank()) {
            where.append(" AND EXISTS (SELECT 1 FROM dbo.user_roles ur JOIN dbo.roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.code = :role)");
            p.put("role", role);
        }
        if (status != null && !status.isBlank()) {
            where.append(" AND u.status = :status");
            p.put("status", status);
        }
        if (createdFrom != null) {
            where.append(" AND u.created_at >= :from");
            p.put("from", Db.ts(createdFrom.atStartOfDay().toInstant(ZoneOffset.ofHours(7))));
        }
        if (createdTo != null) {
            where.append(" AND u.created_at < :to");
            p.put("to", Db.ts(createdTo.plusDays(1).atStartOfDay().toInstant(ZoneOffset.ofHours(7))));
        }
        String order = switch (sort == null ? "" : sort) {
            case "name" -> "u.full_name ASC";
            case "lastLogin" -> "u.last_login_at DESC";
            case "oldest" -> "u.created_at ASC";
            default -> "u.created_at DESC";
        };
        long total = db.sql("SELECT COUNT(*) FROM dbo.users u" + where).params(p).query(Long.class).single();
        p.put("off", page * size);
        p.put("size", size);
        List<UserRow> items = db.sql("""
                SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.status,
                       STUFF((SELECT N',' + r.code FROM dbo.user_roles ur JOIN dbo.roles r ON r.id = ur.role_id
                              WHERE ur.user_id = u.id ORDER BY r.id FOR XML PATH('')), 1, 1, N'') AS roles,
                       u.created_at, u.last_login_at, u.email_verified_at
                FROM dbo.users u""" + where + " ORDER BY " + order + ", u.id DESC OFFSET :off ROWS FETCH NEXT :size ROWS ONLY")
                .params(p).query(UserRow.class).list();
        return PageResponse.of(items, page, size, total);
    }

    public UserDetail detail(long id) {
        record Row(long id, String fullName, String email, Integer birthYear, String hometown, String workplace,
                String phone, String avatarUrl, String status, String lockReason, Instant createdAt, Instant lastLoginAt,
                Instant emailVerifiedAt, boolean showOnLeaderboard) {
        }
        Row u = db.sql("""
                SELECT id, full_name, email, birth_year, hometown, workplace, phone, avatar_url, status, lock_reason,
                       created_at, last_login_at, email_verified_at, show_on_leaderboard
                FROM dbo.users WHERE id = :id AND deleted_at IS NULL""").param("id", id).query(Row.class).optional()
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        List<UserEnrollment> enr = db.sql("""
                SELECT c.id AS course_id, c.title AS course_title, c.slug AS course_slug,
                       CASE WHEN e.status IN (N'IN_PROGRESS', N'CANCELLED') AND e.expires_at <= SYSUTCDATETIME() THEN N'EXPIRED'
                            ELSE e.status END AS status,
                       e.round_no, e.progress_percent, e.enrolled_at, e.expires_at, e.expired_at, e.completed_at,
                       r.total_score
                FROM dbo.enrollments e JOIN dbo.courses c ON c.id = e.course_id
                LEFT JOIN dbo.rankings r ON r.user_id = e.user_id AND r.course_id = e.course_id
                WHERE e.user_id = :id ORDER BY e.enrolled_at DESC""").param("id", id).query(UserEnrollment.class).list();
        return new UserDetail(u.id(), u.fullName(), u.email(), u.birthYear(), u.hometown(), u.workplace(), u.phone(),
                u.avatarUrl(), u.status(), u.lockReason(), roles(id), u.createdAt(), u.lastLoginAt(), u.emailVerifiedAt(),
                u.showOnLeaderboard(), enr);
    }

    private List<String> roles(long userId) {
        return db.sql("SELECT r.code FROM dbo.user_roles ur JOIN dbo.roles r ON r.id = ur.role_id WHERE ur.user_id = :id ORDER BY r.id")
                .param("id", userId).query(String.class).list();
    }

    // ------------------------------------------------------------- ghi

    /** FR-ADM-02. Tài khoản do Admin tạo được coi là đã xác thực email. */
    @Transactional
    public long create(CreateUser r, long actorId) {
        String email = Texts.normalizeEmail(r.email());
        ensureEmailFree(email, null);
        boolean temp = "TEMP_PASSWORD".equals(r.passwordMode());
        String password;
        if (temp) {
            PasswordPolicy.check("tempPassword", r.tempPassword(), email);
            password = r.tempPassword();
        } else {
            password = Secrets.token(); // Mật khẩu ngẫu nhiên không ai biết; người dùng tự đặt qua liên kết.
        }
        long id = db.sql("""
                INSERT INTO dbo.users (email, password_hash, full_name, birth_year, hometown, workplace, phone, status,
                                       email_verified_at, privacy_consent_at)
                OUTPUT INSERTED.id
                VALUES (:email, :pw, :name, :by, :ht, :wp, :phone, :status, SYSUTCDATETIME(), NULL)""")
                .param("email", email).param("pw", encoder.encode(password)).param("name", r.fullName().trim())
                .param("by", r.birthYear()).param("ht", Texts.trimToNull(r.hometown()))
                .param("wp", Texts.trimToNull(r.workplace())).param("phone", Texts.trimToNull(r.phone()))
                .param("status", r.status() == null ? "ACTIVE" : r.status()).query(Long.class).single();
        setRoles(id, r.roles());
        if (!temp) {
            sendSetPasswordLink(id, email, r.fullName().trim());
        }
        audit.log(actorId, "CREATE", "USER", id, null, Map.of("email", email, "roles", r.roles(), "passwordMode", r.passwordMode()));
        return id;
    }

    @Transactional
    public void update(long id, UpdateUser r, long actorId) {
        UserDetail before = detail(id);
        String email = Texts.normalizeEmail(r.email());
        ensureEmailFree(email, id);
        if (id == actorId && !r.roles().contains("ADMIN")) {
            throw ApiException.unprocessable("SELF_ACTION", "Bạn không thể tự gỡ quyền quản trị của chính mình");
        }
        if (before.roles().contains("ADMIN") && !r.roles().contains("ADMIN")) {
            ensureAnotherAdmin(id);
        }
        boolean emailChanged = !email.equals(before.email());
        db.sql("""
                UPDATE dbo.users SET full_name = :name, email = :email, birth_year = :by, hometown = :ht, workplace = :wp,
                    phone = :phone, email_verified_at = CASE WHEN :changed = 1 THEN NULL ELSE email_verified_at END,
                    updated_at = SYSUTCDATETIME() WHERE id = :id""")
                .param("name", r.fullName().trim()).param("email", email).param("by", r.birthYear())
                .param("ht", Texts.trimToNull(r.hometown())).param("wp", Texts.trimToNull(r.workplace()))
                .param("phone", Texts.trimToNull(r.phone())).param("changed", emailChanged ? 1 : 0).param("id", id).update();
        java.util.Set<String> wanted = new java.util.HashSet<>(r.roles());
        wanted.add("USER");
        if (!new java.util.HashSet<>(before.roles()).equals(wanted)) {
            setRoles(id, r.roles());
            audit.log(actorId, "ROLE_CHANGE", "USER", id, Map.of("roles", before.roles()), Map.of("roles", r.roles()));
        }
        audit.log(actorId, "UPDATE", "USER", id, Map.of("fullName", before.fullName(), "email", before.email()),
                Map.of("fullName", r.fullName().trim(), "email", email));
    }

    /** FR-ADM-05: khóa → đăng xuất ngay trên mọi thiết bị. */
    @Transactional
    public void lock(long id, String reason, long actorId) {
        if (id == actorId) {
            throw ApiException.unprocessable("SELF_ACTION", "Bạn không thể tự khóa tài khoản của chính mình");
        }
        if (reason == null || reason.isBlank()) {
            throw ApiException.validation("reason", "Vui lòng nhập lý do khóa");
        }
        if (roles(id).contains("ADMIN")) {
            ensureAnotherAdmin(id);
        }
        int n = db.sql("UPDATE dbo.users SET status = N'LOCKED', lock_reason = :r, updated_at = SYSUTCDATETIME() WHERE id = :id AND deleted_at IS NULL")
                .param("r", reason.trim()).param("id", id).update();
        if (n == 0) {
            throw ApiException.notFound("Không tìm thấy người dùng");
        }
        refreshTokens.revokeAll(id, "ACCOUNT_LOCKED");
        audit.log(actorId, "LOCK", "USER", id, null, Map.of("reason", reason.trim()));
    }

    @Transactional
    public void unlock(long id, long actorId) {
        db.sql("""
                UPDATE dbo.users SET status = CASE WHEN email_verified_at IS NULL THEN N'PENDING_VERIFICATION' ELSE N'ACTIVE' END,
                    lock_reason = NULL, failed_login_count = 0, locked_until = NULL, updated_at = SYSUTCDATETIME()
                WHERE id = :id AND deleted_at IS NULL""").param("id", id).update();
        audit.log(actorId, "UNLOCK", "USER", id, null, null);
    }

    /** FR-ADM-06: xóa mềm, ẩn danh email để email có thể đăng ký lại. */
    @Transactional
    public void delete(long id, long actorId) {
        if (id == actorId) {
            throw ApiException.unprocessable("SELF_ACTION", "Bạn không thể tự xóa tài khoản của chính mình");
        }
        if (roles(id).contains("ADMIN")) {
            ensureAnotherAdmin(id);
        }
        String email = db.sql("SELECT email FROM dbo.users WHERE id = :id AND deleted_at IS NULL").param("id", id)
                .query(String.class).optional().orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        db.sql("""
                UPDATE dbo.users SET deleted_at = SYSUTCDATETIME(), email = :anon, status = N'LOCKED',
                    lock_reason = N'Tài khoản đã bị xóa', updated_at = SYSUTCDATETIME() WHERE id = :id""")
                .param("anon", "deleted_" + id + "@deleted.local").param("id", id).update();
        refreshTokens.revokeAll(id, "ACCOUNT_LOCKED");
        audit.log(actorId, "DELETE", "USER", id, Map.of("email", email), null);
    }

    @Transactional
    public void sendResetPassword(long id, long actorId) {
        record U(String email, String fullName) {
        }
        U u = db.sql("SELECT email, full_name FROM dbo.users WHERE id = :id AND deleted_at IS NULL").param("id", id)
                .query(U.class).optional().orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        sendSetPasswordLink(id, u.email(), u.fullName());
        audit.log(actorId, "RESET_PASSWORD", "USER", id, null, null);
    }

    private void sendSetPasswordLink(long userId, String email, String fullName) {
        String token = Secrets.token();
        db.sql("INSERT INTO dbo.password_reset_tokens (user_id, token_hash, source, expires_at) VALUES (:u, :h, N'ADMIN', :exp)")
                .param("u", userId).param("h", Secrets.sha256(token))
                .param("exp", Db.ts(Instant.now().plus(Duration.ofHours(24)))).update();
        mail.sendSetPasswordLink(email, fullName, props.publicBaseUrl() + "/dat-mat-khau?token=" + token);
    }

    private void setRoles(long userId, List<String> roles) {
        db.sql("DELETE FROM dbo.user_roles WHERE user_id = :u").param("u", userId).update();
        List<String> all = new ArrayList<>(roles);
        if (!all.contains("USER")) {
            all.add("USER");
        }
        db.sql("INSERT INTO dbo.user_roles (user_id, role_id) SELECT :u, id FROM dbo.roles WHERE code IN (:codes)")
                .param("u", userId).param("codes", all).update();
    }

    private void ensureEmailFree(String email, Long exceptId) {
        int n = db.sql("SELECT COUNT(*) FROM dbo.users WHERE email = :e AND deleted_at IS NULL AND id <> :id")
                .param("e", email).param("id", exceptId == null ? -1L : exceptId).query(Integer.class).single();
        if (n > 0) {
            throw new ApiException(org.springframework.http.HttpStatus.CONFLICT, "EMAIL_EXISTS", "Email đã được sử dụng",
                    List.of(new ApiException.FieldError("email", "Email đã được sử dụng")));
        }
    }

    /** BR-AUTH-07: luôn còn ít nhất một Admin đang hoạt động. */
    private void ensureAnotherAdmin(long excludingId) {
        int others = db.sql("""
                SELECT COUNT(*) FROM dbo.users u JOIN dbo.user_roles ur ON ur.user_id = u.id JOIN dbo.roles r ON r.id = ur.role_id
                WHERE r.code = N'ADMIN' AND u.status = N'ACTIVE' AND u.deleted_at IS NULL AND u.id <> :id""")
                .param("id", excludingId).query(Integer.class).single();
        if (others == 0) {
            throw ApiException.unprocessable("LAST_ADMIN", "Hệ thống phải còn ít nhất một quản trị viên đang hoạt động");
        }
    }
}
