package vn.bdhvs.common.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String frontendUrl,
        String publicBaseUrl,
        String mailFrom,
        Jwt jwt,
        Refresh refresh,
        String uploadDir,
        Learning learning,
        BootstrapAdmin bootstrapAdmin,
        boolean seedDemoData) {

    public record Jwt(String secret, Duration accessTtl) {
    }

    public record Refresh(Duration ttl, Duration rememberMeTtl, boolean cookieSecure) {
    }

    /** BR-LRN-09: thời hạn học mặc định khi tạo khóa học mới. */
    public record Learning(int defaultDurationDays) {
    }

    public record BootstrapAdmin(String email, String password, String fullName) {
    }
}
