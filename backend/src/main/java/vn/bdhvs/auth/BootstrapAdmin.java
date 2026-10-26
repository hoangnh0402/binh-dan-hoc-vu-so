package vn.bdhvs.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import vn.bdhvs.common.audit.AuditService;
import vn.bdhvs.common.config.AppProperties;
import vn.bdhvs.common.util.Texts;

/** Tạo tài khoản Admin đầu tiên từ biến môi trường khi chưa có Admin nào (design-db 04 §3.2). */
@Component
@Order(1)
public class BootstrapAdmin implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapAdmin.class);

    private final JdbcClient db;
    private final PasswordEncoder encoder;
    private final AppProperties props;
    private final AuditService audit;

    public BootstrapAdmin(JdbcClient db, PasswordEncoder encoder, AppProperties props, AuditService audit) {
        this.db = db;
        this.encoder = encoder;
        this.props = props;
        this.audit = audit;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int admins = db.sql("""
                SELECT COUNT(*) FROM dbo.user_roles ur JOIN dbo.roles r ON r.id = ur.role_id
                JOIN dbo.users u ON u.id = ur.user_id WHERE r.code = N'ADMIN' AND u.deleted_at IS NULL""")
                .query(Integer.class).single();
        if (admins > 0) {
            return;
        }
        AppProperties.BootstrapAdmin cfg = props.bootstrapAdmin();
        String email = Texts.normalizeEmail(cfg.email());
        long id = db.sql("""
                INSERT INTO dbo.users (email, password_hash, full_name, status, email_verified_at, privacy_consent_at)
                OUTPUT INSERTED.id
                VALUES (:email, :pw, :name, N'ACTIVE', SYSUTCDATETIME(), SYSUTCDATETIME())""")
                .param("email", email).param("pw", encoder.encode(cfg.password())).param("name", cfg.fullName())
                .query(Long.class).single();
        db.sql("INSERT INTO dbo.user_roles (user_id, role_id) SELECT :id, id FROM dbo.roles WHERE code IN (N'ADMIN', N'USER')")
                .param("id", id).update();
        audit.log(null, "CREATE", "USER", id, null, java.util.Map.of("email", email, "role", "ADMIN", "source", "BOOTSTRAP"));
        log.warn("Đã tạo tài khoản Admin đầu tiên {}. Hãy đổi mật khẩu sau lần đăng nhập đầu.", email);
    }
}
