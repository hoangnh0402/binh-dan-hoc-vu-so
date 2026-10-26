package vn.bdhvs.learning;

import java.time.Instant;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import vn.bdhvs.common.error.ApiException;

/** Kiểm tra quyền vào học: đã ghi danh, khóa đã mở, còn thời hạn học (BR-LRN-06, BR-LRN-10). */
@Component
public class LearningAccess {

    private final JdbcClient db;

    public LearningAccess(JdbcClient db) {
        this.db = db;
    }

    public record Access(long enrollmentId, long courseId, String courseSlug, String courseTitle, String status,
            Instant expiresAt, Instant courseStart, Instant courseEnd) {
    }

    public Access require(long courseId, long userId) {
        Access a = db.sql("""
                SELECT e.id AS enrollment_id, c.id AS course_id, c.slug AS course_slug, c.title AS course_title, e.status,
                       e.expires_at, c.start_date AS course_start, c.end_date AS course_end
                FROM dbo.enrollments e JOIN dbo.courses c ON c.id = e.course_id
                WHERE e.course_id = :c AND e.user_id = :u""")
                .param("c", courseId).param("u", userId).query(Access.class).optional()
                .orElseThrow(LearningAccess::notEnrolled);
        if ("CANCELLED".equals(a.status())) {
            throw notEnrolled();
        }
        if ("EXPIRED".equals(a.status()) || EnrollmentService.isOverdue(a.status(), a.expiresAt(), Instant.now())) {
            throw ApiException.forbidden("ENROLLMENT_EXPIRED",
                    "Thời hạn học của bạn đã kết thúc. Bạn cần đăng ký học lại từ đầu");
        }
        if (a.courseStart() != null && a.courseStart().isAfter(Instant.now())) {
            throw ApiException.forbidden("COURSE_NOT_STARTED", "Khóa học chưa đến ngày bắt đầu");
        }
        return a;
    }

    public long courseIdOfLesson(long lessonId) {
        return db.sql("SELECT course_id FROM dbo.lessons WHERE id = :id AND is_published = 1").param("id", lessonId)
                .query(Long.class).optional().orElseThrow(() -> ApiException.notFound("Không tìm thấy bài học"));
    }

    private static ApiException notEnrolled() {
        return ApiException.forbidden("NOT_ENROLLED", "Bạn chưa đăng ký khóa học này");
    }
}
