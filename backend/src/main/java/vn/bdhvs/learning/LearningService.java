package vn.bdhvs.learning;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.bdhvs.catalog.CatalogDtos.CourseDetail;
import vn.bdhvs.catalog.CatalogDtos.LessonItem;
import vn.bdhvs.catalog.CatalogService;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.security.AuthUser;
import vn.bdhvs.learning.LearningAccess.Access;
import vn.bdhvs.learning.LearningDtos.Attachment;
import vn.bdhvs.learning.LearningDtos.CompleteResult;
import vn.bdhvs.learning.LearningDtos.CourseOverview;
import vn.bdhvs.learning.LearningDtos.LessonContent;
import vn.bdhvs.learning.LearningDtos.QuizInfo;

/** Trang học: FR-LRN-01..03, 07..09. */
@Service
public class LearningService {

    /** BR-LRN-01: bài không có quiz chỉ được đánh dấu xong sau khi mở ít nhất 30 giây. */
    private static final int MIN_VIEW_SECONDS = 30;

    private final JdbcClient db;
    private final LearningAccess access;
    private final CatalogService catalog;
    private final ProgressService progress;

    public LearningService(JdbcClient db, LearningAccess access, CatalogService catalog, ProgressService progress) {
        this.db = db;
        this.access = access;
        this.catalog = catalog;
        this.progress = progress;
    }

    public CourseOverview overview(String courseRef, AuthUser user) {
        long courseId = resolveCourseId(courseRef);
        Access a = access.require(courseId, user.id());
        CourseDetail d = catalog.detail(a.courseSlug(), user);
        List<LessonItem> lessons = catalog.lessonStates(courseId, a.enrollmentId());
        Long last = d.myEnrollment() == null ? null : d.myEnrollment().lastLessonId();
        if (last == null) {
            // FR-LRN-09: chưa có bài gần nhất → bài đầu tiên chưa hoàn thành.
            last = lessons.stream().filter(l -> !"COMPLETED".equals(l.state()) && !"LOCKED".equals(l.state()))
                    .map(LessonItem::id).findFirst().orElse(lessons.isEmpty() ? null : lessons.get(0).id());
        }
        return new CourseOverview(courseId, d.slug(), d.title(), d.learningDurationDays(), d.timeStatus(),
                d.myEnrollment(), lessons, last);
    }

    private long resolveCourseId(String ref) {
        if (ref.matches("\\d+")) {
            return Long.parseLong(ref);
        }
        return db.sql("SELECT id FROM dbo.courses WHERE slug = :s").param("s", ref).query(Long.class).optional()
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy khóa học"));
    }

    private LessonItem requireUnlocked(long courseId, long enrollmentId, long lessonId) {
        LessonItem item = catalog.lessonStates(courseId, enrollmentId).stream().filter(l -> l.id() == lessonId)
                .findFirst().orElseThrow(() -> ApiException.notFound("Không tìm thấy bài học"));
        if ("LOCKED".equals(item.state())) {
            throw ApiException.forbidden("LESSON_LOCKED", "Hoàn thành bài trước để mở khóa bài này");
        }
        return item;
    }

    @Transactional
    public LessonContent lesson(long lessonId, AuthUser user) {
        long courseId = access.courseIdOfLesson(lessonId);
        Access a = access.require(courseId, user.id());
        requireUnlocked(courseId, a.enrollmentId(), lessonId);
        progress.markOpened(a.enrollmentId(), lessonId);

        List<LessonItem> lessons = catalog.lessonStates(courseId, a.enrollmentId());
        int idx = 0;
        for (int i = 0; i < lessons.size(); i++) {
            if (lessons.get(i).id() == lessonId) {
                idx = i;
            }
        }
        LessonItem item = lessons.get(idx);
        Long prev = idx > 0 ? lessons.get(idx - 1).id() : null;
        Long next = idx < lessons.size() - 1 && !"LOCKED".equals(lessons.get(idx + 1).state()) ? lessons.get(idx + 1).id() : null;

        record L(String title, String content, String videoUrl, String assignment, Integer estimatedMinutes) {
        }
        L l = db.sql("SELECT title, content, video_url, assignment, estimated_minutes FROM dbo.lessons WHERE id = :id")
                .param("id", lessonId).query(L.class).single();
        Instant startedAt = db.sql("SELECT started_at FROM dbo.lesson_progress WHERE enrollment_id = :e AND lesson_id = :l")
                .param("e", a.enrollmentId()).param("l", lessonId).query(Instant.class).single();
        List<Attachment> attachments = db.sql("""
                SELECT la.id, la.display_name AS name, f.public_url AS url, f.content_type, f.size_bytes
                FROM dbo.lesson_attachments la JOIN dbo.uploaded_files f ON f.id = la.file_id
                WHERE la.lesson_id = :id ORDER BY la.order_index, la.id""").param("id", lessonId)
                .query(Attachment.class).list();
        return new LessonContent(lessonId, courseId, a.courseSlug(), a.courseTitle(), item.orderIndex(), lessons.size(),
                l.title(), l.content(), l.videoUrl(), l.assignment(), l.estimatedMinutes(), item.state(), startedAt,
                attachments, quizInfo(lessonId, user.id(), a.enrollmentId()), prev, next, a.expiresAt());
    }

    QuizInfo quizInfo(long lessonId, long userId, long enrollmentId) {
        record Q(long id, String title, Integer timeLimitSeconds, int passScorePercent, Integer maxAttempts,
                int retryCooldownSeconds) {
        }
        Q q = db.sql("""
                SELECT id, title, time_limit_seconds, pass_score_percent, max_attempts, retry_cooldown_seconds
                FROM dbo.quizzes WHERE lesson_id = :l""").param("l", lessonId).query(Q.class).optional().orElse(null);
        if (q == null) {
            return null;
        }
        int questionCount = db.sql("SELECT COUNT(*) FROM dbo.questions WHERE quiz_id = :q AND is_active = 1")
                .param("q", q.id()).query(Integer.class).single();
        record Stat(int used, Instant lastSubmitted, BigDecimal best, Integer anyPassed) {
        }
        Stat s = db.sql("""
                SELECT COUNT(*) AS used, MAX(submitted_at) AS last_submitted, MAX(score_percent) AS best,
                       MAX(CAST(passed AS INT)) AS any_passed
                FROM dbo.quiz_attempts WHERE quiz_id = :q AND enrollment_id = :e AND status IN (N'SUBMITTED', N'EXPIRED')""")
                .param("q", q.id()).param("e", enrollmentId).query(Stat.class).single();
        Long inProgress = db.sql("SELECT id FROM dbo.quiz_attempts WHERE quiz_id = :q AND user_id = :u AND status = N'IN_PROGRESS'")
                .param("q", q.id()).param("u", userId).query(Long.class).optional().orElse(null);
        Instant nextAt = s.lastSubmitted() == null || q.retryCooldownSeconds() == 0 ? null
                : s.lastSubmitted().plusSeconds(q.retryCooldownSeconds());
        if (nextAt != null && nextAt.isBefore(Instant.now())) {
            nextAt = null;
        }
        return new QuizInfo(q.id(), q.title(), questionCount, q.timeLimitSeconds(), q.passScorePercent(),
                q.maxAttempts(), s.used(), q.retryCooldownSeconds(), nextAt, inProgress, s.best(),
                s.anyPassed() != null && s.anyPassed() == 1);
    }

    /** BR-LRN-01: "Đánh dấu đã học xong" cho bài không có quiz. */
    @Transactional
    public CompleteResult complete(long lessonId, AuthUser user) {
        long courseId = access.courseIdOfLesson(lessonId);
        Access a = access.require(courseId, user.id());
        requireUnlocked(courseId, a.enrollmentId(), lessonId);
        boolean hasQuiz = db.sql("SELECT COUNT(*) FROM dbo.quizzes WHERE lesson_id = :l").param("l", lessonId)
                .query(Integer.class).single() > 0;
        if (hasQuiz) {
            throw ApiException.unprocessable("LESSON_HAS_QUIZ", "Bài học này hoàn thành khi bạn làm quiz đạt yêu cầu");
        }
        Instant startedAt = db.sql("SELECT started_at FROM dbo.lesson_progress WHERE enrollment_id = :e AND lesson_id = :l")
                .param("e", a.enrollmentId()).param("l", lessonId).query(Instant.class).optional().orElse(Instant.now());
        if (startedAt.plusSeconds(MIN_VIEW_SECONDS).isAfter(Instant.now())) {
            throw ApiException.unprocessable("MIN_VIEW_TIME", "Hãy xem nội dung bài ít nhất 30 giây trước khi đánh dấu đã học xong");
        }
        boolean newly = progress.completeLesson(a.enrollmentId(), lessonId, "MANUAL");
        ProgressService.Progress p = progress.recompute(a.enrollmentId());
        return new CompleteResult(newly, progress.nextUnlocked(courseId, a.enrollmentId(), lessonId), p.percent(), p.completed());
    }
}
