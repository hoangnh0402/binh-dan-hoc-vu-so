package vn.bdhvs.common.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import vn.bdhvs.common.config.AppProperties;

/** Access token JWT, hiệu lực 15 phút (SRS 01 §2.2). */
@Service
public class JwtService {

    private final SecretKey key;
    private final AppProperties props;

    public JwtService(AppProperties props) {
        this.props = props;
        byte[] secret = props.jwt().secret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("JWT_SECRET phải dài tối thiểu 32 byte");
        }
        this.key = Keys.hmacShaKeyFor(secret);
    }

    public String issue(long userId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(Long.toString(userId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.jwt().accessTtl())))
                .signWith(key)
                .compact();
    }

    public long expiresInSeconds() {
        return props.jwt().accessTtl().toSeconds();
    }

    /** @return userId, hoặc null nếu token sai/hết hạn. */
    public Long parse(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return Long.valueOf(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
