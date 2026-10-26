package vn.bdhvs.learning;

import java.util.List;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import vn.bdhvs.catalog.CatalogDtos.LessonItem;
import vn.bdhvs.catalog.CatalogService;
import vn.bdhvs.learning.LearningDtos.LessonRef;

/** Tiến độ và hoàn thành: FR-LRN-07, 08, 11; SQL theo design-db 05 §5. */
@Service
public class ProgressService {

    private final JdbcClient db;
    private final CatalogService catalog;

    public ProgressService(JdbcClient db, CatalogService catalog) {
        this.db = db;
        this.catalog = catalog;
    }

    public record Progress(int percent, boolean completed) {
    }

    /** Ghi nhận mở bài lần đầu (idempotent) và bài học gần nhất (FR-LRN-09). */
    public void markOpened(long enrollmentId, long lessonId) {
        db.sql("""
                INSERT INTO dbo.lesson_progress (enrollment_id, lesson_id, status)
                SELECT :eid, :lid, N'IN_PROGRESS'
                WHERE NOT EXISTS (SELECT 1 FROM dbo.lesson_progress WITH (UPDLOCK, HOLDLOCK)
                                  WHERE enrollment_id = :eid AND lesson_id = :lid)""")
                .param("eid", enrollmentId).param("lid", lessonId).update();
        db.sql("UPDATE dbo.enrollments SET last_lesson_id = :lid, updated_at = SYSUTCDATETIME() WHERE id = :eid")
                .param("lid", lessonId).param("eid", enrollmentId).update();
    }

    /** BR-LRN-01: đánh dấu bài hoàn thành. Trả về true nếu lần này mới hoàn thành. */
    public boolean completeLesson(long enrollmentId, long lessonId, String method) {
        markOpened(enrollmentId, lessonId);
        return db.sql("""
                UPDATE dbo.lesson_progress SET status = N'COMPLETED', completion_method = :m, completed_at = SYSUTCDATETIME()
                WHERE enrollment_id = :eid AND lesson_id = :lid AND status = N'IN_PROGRESS'""")
                .param("m", method).param("eid", enrollmentId).param("lid", lessonId).update() > 0;
    }

    public Progress recompute(long enrollmentId) {
        db.sql("""
                UPDATE e
                SET e.completed_lesson_count = x.done,
                    e.progress_percent = CASE WHEN x.total = 0 THEN 0 WHEN x.done >= x.total THEN 100 ELSE x.done * 100 / x.total END,
                    e.status = CASE WHEN e.status = N'IN_PROGRESS' AND x.total > 0 AND x.done >= x.total THEN N'COMPLETED' ELSE e.status END,
                    e.completed_at = CASE WHEN e.status = N'IN_PROGRESS' AND x.total > 0 AND x.done >= x.total
                                          THEN SYSUTCDATETIME() ELSE e.completed_at END,
                    e.updated_at = SYSUTCDATETIME(), e.version = e.version + 1
                FROM dbo.enrollments e
                CROSS APPLY (
                    SELECT COUNT(*) AS total, ISNULL(SUM(CASE WHEN lp.status = N'COMPLETED' THEN 1 ELSE 0 END), 0) AS done
                    FROM dbo.lessons l
                    LEFT JOIN dbo.lesson_progress lp ON lp.lesson_id = l.id AND lp.enrollment_id = e.id
                    WHERE l.course_id = e.course_id AND l.is_published = 1
                ) x
                WHERE e.id = :eid""").param("eid", enrollmentId).update();
        return db.sql("SELECT progress_percent, CASE WHEN status = N'COMPLETED' THEN 1 ELSE 0 END FROM dbo.enrollments WHERE id = :eid")
                .param("eid", enrollmentId).query((rs, i) -> new Progress(rs.getInt(1), rs.getInt(2) == 1)).single();
    }

    /** Bài kế tiếp sau bài vừa học, nếu đã mở khóa. */
    public LessonRef nextUnlocked(long courseId, long enrollmentId, long currentLessonId) {
        List<LessonItem> lessons = catalog.lessonStates(courseId, enrollmentId);
        boolean after = false;
        for (LessonItem l : lessons) {
            if (after) {
                return "LOCKED".equals(l.state()) ? null : new LessonRef(l.id(), l.title());
            }
            after = l.id() == currentLessonId;
        }
        return null;
    }
}
