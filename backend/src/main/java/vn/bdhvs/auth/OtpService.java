package vn.bdhvs.auth;

import java.time.Duration;
import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.mail.MailService;
import vn.bdhvs.common.util.Db;
import vn.bdhvs.common.util.RateLimiter;
import vn.bdhvs.common.util.Secrets;

/** OTP qua email: BR-AUTH-02 (5 phút, 1 lần, lưu hash), BR-AUTH-03 (5 lần sai), BR-AUTH-04 (giới hạn gửi). */
@Service
public class OtpService {

    static final Duration TTL = Duration.ofMinutes(5);
    static final Duration RESEND_GAP = Duration.ofSeconds(60);
    private static final int MAX_PER_HOUR = 5;
    private static final int MAX_FAILED = 5;

    private final JdbcClient db;
    private final MailService mail;
    private final RateLimiter rateLimiter;

    public OtpService(JdbcClient db, MailService mail, RateLimiter rateLimiter) {
        this.db = db;
        this.mail = mail;
        this.rateLimiter = rateLimiter;
    }

    private record Stat(int sentLastHour, Instant lastSentAt) {
    }

    private record ActiveOtp(long id, String codeHash, Instant expiresAt, int failedAttempts) {
    }

    public void issue(long userId, String email, String fullName, String purpose, String ip) {
        Stat stat = db.sql("""
                SELECT COUNT(*) AS sent_last_hour, MAX(created_at) AS last_sent_at FROM dbo.otp_codes
                WHERE user_id = :uid AND purpose = :purpose AND created_at > DATEADD(HOUR, -1, SYSUTCDATETIME())""")
                .param("uid", userId).param("purpose", purpose).query(Stat.class).single();
        if (stat.lastSentAt() != null && stat.lastSentAt().plus(RESEND_GAP).isAfter(Instant.now())) {
            long wait = Duration.between(Instant.now(), stat.lastSentAt().plus(RESEND_GAP)).toSeconds() + 1;
            throw ApiException.tooMany("OTP_RESEND_TOO_SOON", "Vui lòng đợi " + wait + " giây trước khi gửi lại mã");
        }
        if (stat.sentLastHour() >= MAX_PER_HOUR) {
            throw ApiException.tooMany("TOO_MANY_REQUESTS", "Bạn đã yêu cầu mã quá nhiều lần, vui lòng thử lại sau 1 giờ");
        }
        if (ip != null) {
            rateLimiter.check("otp-ip:" + ip, 20, Duration.ofHours(1));
        }
        String code = Secrets.otp();
        db.sql("""
                UPDATE dbo.otp_codes SET invalidated_at = SYSUTCDATETIME()
                WHERE user_id = :uid AND purpose = :purpose AND consumed_at IS NULL AND invalidated_at IS NULL""")
                .param("uid", userId).param("purpose", purpose).update();
        db.sql("""
                INSERT INTO dbo.otp_codes (user_id, purpose, code_hash, expires_at, request_ip)
                VALUES (:uid, :purpose, :hash, :expires, :ip)""")
                .param("uid", userId).param("purpose", purpose).param("hash", hash(userId, code))
                .param("expires", Db.ts(Instant.now().plus(TTL))).param("ip", ip)
                .update();
        mail.sendOtp(email, fullName, code, purpose);
    }

    /**
     * Kiểm tra OTP. Không chạy trong transaction để lượt nhập sai luôn được ghi lại dù sau đó ném lỗi.
     */
    public void verify(long userId, String purpose, String code) {
        ActiveOtp otp = db.sql("""
                SELECT TOP (1) id, code_hash, expires_at, failed_attempts FROM dbo.otp_codes
                WHERE user_id = :uid AND purpose = :purpose AND consumed_at IS NULL AND invalidated_at IS NULL
                ORDER BY created_at DESC""")
                .param("uid", userId).param("purpose", purpose).query(ActiveOtp.class).optional()
                .orElseThrow(() -> ApiException.unprocessable("OTP_EXPIRED", "Mã OTP đã hết hạn hoặc không còn hiệu lực, vui lòng gửi lại mã"));
        if (otp.expiresAt().isBefore(Instant.now())) {
            throw ApiException.unprocessable("OTP_EXPIRED", "Mã OTP đã hết hạn, vui lòng gửi lại mã");
        }
        if (!Secrets.constantTimeEquals(otp.codeHash(), hash(userId, code))) {
            int failed = otp.failedAttempts() + 1;
            db.sql("""
                    UPDATE dbo.otp_codes SET failed_attempts = :f,
                        invalidated_at = CASE WHEN :f >= :max THEN SYSUTCDATETIME() ELSE invalidated_at END
                    WHERE id = :id""")
                    .param("f", failed).param("max", MAX_FAILED).param("id", otp.id()).update();
            if (failed >= MAX_FAILED) {
                throw ApiException.unprocessable("MAX_ATTEMPTS_REACHED", "Bạn đã nhập sai quá 5 lần. Vui lòng gửi lại mã mới");
            }
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "OTP_INVALID",
                    "Mã OTP không đúng, bạn còn " + (MAX_FAILED - failed) + " lần thử");
        }
        int updated = db.sql("UPDATE dbo.otp_codes SET consumed_at = SYSUTCDATETIME() WHERE id = :id AND consumed_at IS NULL")
                .param("id", otp.id()).update();
        if (updated == 0) {
            throw ApiException.unprocessable("OTP_EXPIRED", "Mã OTP đã được sử dụng");
        }
    }

    private static String hash(long userId, String code) {
        return Secrets.sha256(userId + ":" + code);
    }
}
