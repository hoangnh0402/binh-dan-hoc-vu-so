package vn.bdhvs.auth;

import java.time.Instant;

import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.bdhvs.common.config.AppProperties;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.util.Db;
import vn.bdhvs.common.util.Secrets;

/** Refresh token: chuỗi ngẫu nhiên lưu hash, xoay vòng, phát hiện tái sử dụng (FR-AUTH-05). */
@Service
public class RefreshTokenService {

    public static final String COOKIE = "refresh_token";
    private static final String COOKIE_PATH = "/api/v1/auth";

    private final JdbcClient db;
    private final AppProperties props;

    public RefreshTokenService(JdbcClient db, AppProperties props) {
        this.db = db;
        this.props = props;
    }

    public record Issued(String raw, boolean rememberMe) {
    }

    public record Rotated(long userId, Issued token) {
    }

    private record Row(long id, long userId, boolean rememberMe, Instant expiresAt, Instant revokedAt) {
    }

    public Issued create(long userId, boolean rememberMe, String userAgent, String ip) {
        String raw = Secrets.token();
        insert(userId, raw, rememberMe, userAgent, ip);
        return new Issued(raw, rememberMe);
    }

    private long insert(long userId, String raw, boolean rememberMe, String userAgent, String ip) {
        Instant expires = Instant.now().plus(rememberMe ? props.refresh().rememberMeTtl() : props.refresh().ttl());
        return db.sql("""
                INSERT INTO dbo.refresh_tokens (user_id, token_hash, remember_me, expires_at, user_agent, ip_address)
                OUTPUT INSERTED.id
                VALUES (:uid, :hash, :rm, :exp, :ua, :ip)""")
                .param("uid", userId).param("hash", Secrets.sha256(raw)).param("rm", rememberMe)
                .param("exp", Db.ts(expires)).param("ua", userAgent == null ? null : userAgent.substring(0, Math.min(500, userAgent.length())))
                .param("ip", ip).query(Long.class).single();
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Rotated rotate(String raw, String userAgent, String ip) {
        Row row = db.sql("""
                SELECT id, user_id, remember_me, expires_at, revoked_at FROM dbo.refresh_tokens WITH (UPDLOCK)
                WHERE token_hash = :hash""")
                .param("hash", Secrets.sha256(raw)).query(Row.class).optional()
                .orElseThrow(() -> ApiException.unauthorized("TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn"));
        if (row.revokedAt() != null) {
            // Token đã thu hồi bị dùng lại: nghi bị đánh cắp, thu hồi toàn bộ phiên của người dùng.
            revokeAll(row.userId(), "REUSE_DETECTED");
            throw ApiException.unauthorized("TOKEN_EXPIRED", "Phiên đăng nhập không còn hợp lệ, vui lòng đăng nhập lại");
        }
        if (row.expiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn");
        }
        String next = Secrets.token();
        long nextId = insert(row.userId(), next, row.rememberMe(), userAgent, ip);
        db.sql("UPDATE dbo.refresh_tokens SET revoked_at = SYSUTCDATETIME(), revoked_reason = N'ROTATED', replaced_by_id = :next WHERE id = :id")
                .param("next", nextId).param("id", row.id()).update();
        return new Rotated(row.userId(), new Issued(next, row.rememberMe()));
    }

    public java.util.Optional<Long> activeUserId(String raw) {
        return db.sql("""
                SELECT user_id FROM dbo.refresh_tokens
                WHERE token_hash = :hash AND revoked_at IS NULL AND expires_at > SYSUTCDATETIME()""")
                .param("hash", Secrets.sha256(raw)).query(Long.class).optional();
    }

    public void revoke(String raw, String reason) {
        db.sql("UPDATE dbo.refresh_tokens SET revoked_at = SYSUTCDATETIME(), revoked_reason = :reason WHERE token_hash = :hash AND revoked_at IS NULL")
                .param("reason", reason).param("hash", Secrets.sha256(raw)).update();
    }

    public void revokeAll(long userId, String reason) {
        db.sql("UPDATE dbo.refresh_tokens SET revoked_at = SYSUTCDATETIME(), revoked_reason = :reason WHERE user_id = :uid AND revoked_at IS NULL")
                .param("reason", reason).param("uid", userId).update();
    }

    /** Thu hồi mọi phiên khác, giữ phiên hiện tại (FR-AUTH-08). */
    public void revokeOthers(long userId, String keepRaw, String reason) {
        db.sql("""
                UPDATE dbo.refresh_tokens SET revoked_at = SYSUTCDATETIME(), revoked_reason = :reason
                WHERE user_id = :uid AND revoked_at IS NULL AND token_hash <> :keep""")
                .param("reason", reason).param("uid", userId).param("keep", keepRaw == null ? "" : Secrets.sha256(keepRaw)).update();
    }

    public ResponseCookie cookie(Issued token) {
        return ResponseCookie.from(COOKIE, token.raw())
                .httpOnly(true).secure(props.refresh().cookieSecure()).sameSite("Strict").path(COOKIE_PATH)
                .maxAge(token.rememberMe() ? props.refresh().rememberMeTtl() : props.refresh().ttl())
                .build();
    }

    public ResponseCookie clearCookie() {
        return ResponseCookie.from(COOKIE, "").httpOnly(true).secure(props.refresh().cookieSecure())
                .sameSite("Strict").path(COOKIE_PATH).maxAge(0).build();
    }
}
