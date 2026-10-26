package vn.bdhvs.learning;

import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.util.Db;

/**
 * Ghi danh, hủy, học lại và thời hạn học.
 * FR-CRS-09, FR-CRS-11, FR-LRN-12, BR-LRN-09..12; SQL theo design-db 05 §3 và §8.1.
 */
@Service
public class EnrollmentService {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentService.class);

    private final JdbcClient db;
    private final TransactionTemplate tx;

    public EnrollmentService(JdbcClient db, TransactionTemplate tx) {
        this.db = db;
        this.tx = tx;
    }

    public record EnrollResult(long enrollmentId, String status, int roundNo, int progressPercent,
            Instant learningStartedAt, Instant expiresAt, int learningDurationDays) {
    }

    private record CourseRow(long id, String publishStatus, Instant startDate, Instant endDate, int learningDurationDays) {
    }

    private record EnrollmentRow(long id, String status, Instant expiresAt) {
    }

    @Transactional
    public EnrollResult enroll(long courseId, long userId) {
        CourseRow c = db.sql("""
                SELECT id, publish_status, start_date, end_date, learning_duration_days FROM dbo.courses WITH (UPDLOCK)
                WHERE id = :id""").param("id", courseId).query(CourseRow.class).single();
        Instant now = Instant.now();
        // BR-CRS-02: chỉ nhận ghi danh khi khóa đã xuất bản và chưa kết thúc ("Sắp mở" được ghi danh trước).
        if (!"PUBLISHED".equals(c.publishStatus()) || (c.endDate() != null && c.endDate().isBefore(now))) {
            throw ApiException.unprocessable("COURSE_NOT_OPEN", "Khóa học không còn nhận đăng ký");
        }
        EnrollmentRow existing = db.sql("""
                SELECT id, status, expires_at FROM dbo.enrollments WITH (UPDLOCK, HOLDLOCK)
                WHERE user_id = :u AND course_id = :c""").param("u", userId).param("c", courseId)
                .query(EnrollmentRow.class).optional().orElse(null);

        if (existing != null && isOverdue(existing.status(), existing.expiresAt(), now)) {
            // Job chưa kịp xử lý: dọn dữ liệu của lượt đã hết hạn ngay trong transaction này (design-db 05 §3).
            expireInCurrentTx(existing.id());
            existing = new EnrollmentRow(existing.id(), "EXPIRED", existing.expiresAt());
        }
        // BR-LRN-09: tính hạn từ lúc ghi danh, hoặc từ start_date nếu khóa "Sắp mở".
        Instant startAt = c.startDate() != null && c.startDate().isAfter(now) ? c.startDate() : now;
        Instant expiresAt = startAt.plusSeconds(c.learningDurationDays() * 86_400L);

        if (existing == null) {
            db.sql("""
                    INSERT INTO dbo.enrollments (user_id, course_id, enrolled_at, learning_started_at, expires_at)
                    VALUES (:u, :c, SYSUTCDATETIME(), :start, :exp)""")
                    .param("u", userId).param("c", courseId).param("start", Db.ts(startAt)).param("exp", Db.ts(expiresAt))
                    .update();
        } else {
            switch (existing.status()) {
                case "IN_PROGRESS", "COMPLETED" ->
                    throw ApiException.conflict("ALREADY_ENROLLED", "Bạn đã đăng ký khóa học này");
                case "CANCELLED" -> // FR-CRS-11: còn hạn → khôi phục tiến độ, giữ hạn cũ.
                    db.sql("""
                            UPDATE dbo.enrollments SET status = N'IN_PROGRESS', cancelled_at = NULL,
                                updated_at = SYSUTCDATETIME(), version = version + 1 WHERE id = :id""")
                            .param("id", existing.id()).update();
                case "EXPIRED" -> // BR-LRN-11: học lại từ đầu với lượt mới.
                    db.sql("""
                            UPDATE dbo.enrollments SET status = N'IN_PROGRESS', round_no = round_no + 1,
                                progress_percent = 0, completed_lesson_count = 0, last_lesson_id = NULL,
                                enrolled_at = SYSUTCDATETIME(), learning_started_at = :start, expires_at = :exp,
                                completed_at = NULL, cancelled_at = NULL, expired_at = NULL, expiry_reminder_stage = 0,
                                updated_at = SYSUTCDATETIME(), version = version + 1
                            WHERE id = :id""")
                            .param("start", Db.ts(startAt)).param("exp", Db.ts(expiresAt)).param("id", existing.id()).update();
                default -> throw new IllegalStateException(existing.status());
            }
        }
        refreshEnrollmentCount(courseId);
        return db.sql("""
                SELECT e.id, e.status, e.round_no, e.progress_percent, e.learning_started_at, e.expires_at, c.learning_duration_days
                FROM dbo.enrollments e JOIN dbo.courses c ON c.id = e.course_id
                WHERE e.user_id = :u AND e.course_id = :c""")
                .param("u", userId).param("c", courseId)
                .query((rs, i) -> new EnrollResult(rs.getLong(1), rs.getString(2), rs.getInt(3), rs.getInt(4),
                        rs.getTimestamp(5).toInstant(), rs.getTimestamp(6).toInstant(), rs.getInt(7)))
                .single();
    }

    /** FR-CRS-11: hủy ghi danh. Không dừng thời hạn học. */
    @Transactional
    public void cancel(long courseId, long userId) {
        int n = db.sql("""
                UPDATE dbo.enrollments SET status = N'CANCELLED', cancelled_at = SYSUTCDATETIME(),
                    updated_at = SYSUTCDATETIME(), version = version + 1
                WHERE user_id = :u AND course_id = :c AND status = N'IN_PROGRESS' AND expires_at > SYSUTCDATETIME()""")
                .param("u", userId).param("c", courseId).update();
        if (n == 0) {
            throw ApiException.unprocessable("NOT_ENROLLED", "Bạn không có lượt học đang diễn ra để hủy");
        }
        refreshEnrollmentCount(courseId);
    }

    static boolean isOverdue(String status, Instant expiresAt, Instant now) {
        return ("IN_PROGRESS".equals(status) || "CANCELLED".equals(status)) && expiresAt != null && !expiresAt.isAfter(now);
    }

    private void refreshEnrollmentCount(long courseId) {
        db.sql("""
                UPDATE dbo.courses SET enrollment_count = (SELECT COUNT(*) FROM dbo.enrollments
                    WHERE course_id = :c AND status IN (N'IN_PROGRESS', N'COMPLETED'))
                WHERE id = :c""").param("c", courseId).update();
    }

    // ------------------------------------------------------------- hết hạn học (BR-LRN-10)

    /** Job 5 phút/lần (design-db 05 §8.1): mỗi enrollment một transaction riêng. */
    @Scheduled(fixedDelayString = "PT5M", initialDelayString = "PT30S")
    public void expireOverdue() {
        List<Long> ids = db.sql("""
                SELECT TOP (200) id FROM dbo.enrollments
                WHERE status IN (N'IN_PROGRESS', N'CANCELLED') AND expires_at <= SYSUTCDATETIME()
                ORDER BY expires_at""").query(Long.class).list();
        int done = 0;
        for (Long id : ids) {
            try {
                Boolean ok = tx.execute(s -> expireInCurrentTx(id));
                if (Boolean.TRUE.equals(ok)) {
                    done++;
                }
            } catch (RuntimeException e) {
                log.error("Không xử lý được hết hạn cho enrollment {}", id, e);
            }
        }
        if (done > 0) {
            log.info("Đã đóng {} lượt học hết hạn và xóa dữ liệu học tập", done);
        }
    }

    /** Xóa dữ liệu học tập của một lượt quá hạn và chuyển sang EXPIRED. Gọi trong transaction đang mở. */
    boolean expireInCurrentTx(long enrollmentId) {
        record Row(long userId, long courseId) {
        }
        Row r = db.sql("""
                SELECT user_id, course_id FROM dbo.enrollments WITH (UPDLOCK, HOLDLOCK)
                WHERE id = :id AND status IN (N'IN_PROGRESS', N'CANCELLED') AND expires_at <= SYSUTCDATETIME()""")
                .param("id", enrollmentId).query(Row.class).optional().orElse(null);
        if (r == null) {
            return false; // Đã hoàn thành ngay trước hạn hoặc đã được xử lý (BR-LRN-12).
        }
        db.sql("DELETE FROM dbo.quiz_best_attempts WHERE user_id = :u AND course_id = :c")
                .param("u", r.userId()).param("c", r.courseId()).update();
        db.sql("DELETE FROM dbo.rankings WHERE user_id = :u AND course_id = :c")
                .param("u", r.userId()).param("c", r.courseId()).update();
        db.sql("DELETE FROM dbo.quiz_attempts WHERE enrollment_id = :id").param("id", enrollmentId).update();
        db.sql("DELETE FROM dbo.lesson_progress WHERE enrollment_id = :id").param("id", enrollmentId).update();
        db.sql("""
                UPDATE dbo.enrollments SET status = N'EXPIRED', expired_at = SYSUTCDATETIME(),
                    progress_percent = 0, completed_lesson_count = 0, last_lesson_id = NULL,
                    updated_at = SYSUTCDATETIME(), version = version + 1
                WHERE id = :id""").param("id", enrollmentId).update();
        refreshEnrollmentCount(r.courseId());
        return true;
    }
}
