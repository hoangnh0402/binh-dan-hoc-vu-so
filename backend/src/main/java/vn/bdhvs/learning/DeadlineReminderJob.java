package vn.bdhvs.learning;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import vn.bdhvs.common.config.AppProperties;
import vn.bdhvs.common.mail.MailService;

/** FR-LRN-13: email nhắc hạn học ở mốc 3 ngày và 24 giờ (design-db 05 §8.2). */
@Component
public class DeadlineReminderJob {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final JdbcClient db;
    private final MailService mail;
    private final AppProperties props;

    public DeadlineReminderJob(JdbcClient db, MailService mail, AppProperties props) {
        this.db = db;
        this.mail = mail;
        this.props = props;
    }

    private record Due(long id, String email, String fullName, String title, String slug, int progressPercent,
            Instant expiresAt) {
    }

    @Scheduled(fixedDelayString = "PT15M", initialDelayString = "PT1M")
    public void run() {
        // Mốc 24 giờ trước, mốc 3 ngày sau: lượt có thời hạn ngắn không nhận cả 2 email cùng lúc.
        send(2, "e.expiry_reminder_stage < 2 AND e.expires_at > SYSUTCDATETIME() AND e.expires_at <= DATEADD(HOUR, 24, SYSUTCDATETIME())");
        send(1, "e.expiry_reminder_stage = 0 AND e.expires_at > DATEADD(HOUR, 24, SYSUTCDATETIME()) AND e.expires_at <= DATEADD(DAY, 3, SYSUTCDATETIME())");
    }

    private void send(int stage, String condition) {
        db.sql("""
                SELECT TOP (500) e.id, u.email, u.full_name, c.title, c.slug, e.progress_percent, e.expires_at
                FROM dbo.enrollments e JOIN dbo.users u ON u.id = e.user_id JOIN dbo.courses c ON c.id = e.course_id
                WHERE e.status = N'IN_PROGRESS' AND u.status = N'ACTIVE' AND u.deleted_at IS NULL AND\s""" + condition)
                .query(Due.class).list()
                .forEach(d -> {
                    int marked = db.sql("UPDATE dbo.enrollments SET expiry_reminder_stage = :s WHERE id = :id AND expiry_reminder_stage < :s")
                            .param("s", stage).param("id", d.id()).update();
                    if (marked > 0) {
                        mail.sendDeadlineReminder(d.email(), d.fullName(), d.title(), d.progressPercent(),
                                FMT.format(d.expiresAt()), props.publicBaseUrl() + "/hoc/" + d.slug());
                    }
                });
    }
}
