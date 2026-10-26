package vn.bdhvs.admin;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import vn.bdhvs.common.audit.AuditService;
import vn.bdhvs.common.config.AppProperties;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.util.Db;
import vn.bdhvs.common.util.Html;
import vn.bdhvs.common.util.Texts;
import vn.bdhvs.common.web.PageResponse;
import vn.bdhvs.learning.QuizService;
import vn.bdhvs.ranking.RankingService;

/** Quản lý khóa học: FR-ADM-12..15, 18, 19; BR-ADM-06..08; thời hạn học BR-LRN-09. */
@Service
public class AdminCourseService {

    private final JdbcClient db;
    private final AuditService audit;
    private final SearchTextService searchText;
    private final AdminTaxonomyService taxonomy;
    private final AppProperties props;
    private final QuizService quizzes;
    private final RankingService ranking;
    private final TransactionTemplate tx;

    public AdminCourseService(JdbcClient db, AuditService audit, SearchTextService searchText,
            AdminTaxonomyService taxonomy, AppProperties props, QuizService quizzes, RankingService ranking,
            TransactionTemplate tx) {
        this.db = db;
        this.audit = audit;
        this.searchText = searchText;
        this.taxonomy = taxonomy;
        this.props = props;
        this.quizzes = quizzes;
        this.ranking = ranking;
        this.tx = tx;
    }

    public record CourseRow(long id, String slug, String title, String thumbnailUrl, String categoryName,
            String parentCategoryName, String organizationName, String level, String publishStatus, String timeStatus,
            int publishedLessonCount, int lessonCount, int enrollmentCount, int learningDurationDays, boolean isFeatured,
            Instant updatedAt) {
    }

    public record CourseForm(long id, String slug, String title, long categoryId, long organizationId, String level,
            String shortDescription, String description, String outcomes, String targetAudience, String prerequisites,
            String thumbnailUrl, Instant startDate, Instant endDate, int learningDurationDays, Integer estimatedMinutes,
            boolean isFeatured, String certificateCriteria, String publishStatus, String timeStatus, Instant publishedAt,
            int enrollmentCount, int activeLearners, int publishedLessonCount, Instant updatedAt) {
    }

    public record CourseRequest(
            @NotBlank(message = "Vui lòng nhập tên khóa học") @Size(min = 5, max = 200, message = "Tên khóa học dài 5–200 ký tự") String title,
            @Size(max = 220) String slug,
            @NotNull(message = "Vui lòng chọn loại khóa học") Long categoryId,
            @NotNull(message = "Vui lòng chọn tổ chức đào tạo") Long organizationId,
            @NotBlank @Pattern(regexp = "BASIC|INTERMEDIATE|ADVANCED") String level,
            @NotBlank(message = "Vui lòng nhập mô tả ngắn") @Size(max = 300, message = "Mô tả ngắn tối đa 300 ký tự") String shortDescription,
            @NotBlank(message = "Vui lòng nhập mô tả chi tiết") String description,
            String outcomes, String targetAudience, String prerequisites,
            @Size(max = 500) String thumbnailUrl,
            Instant startDate, Instant endDate,
            @Min(value = 1, message = "Thời hạn học tối thiểu 1 ngày") @Max(value = 365, message = "Thời hạn học tối đa 365 ngày") Integer learningDurationDays,
            @Min(0) Integer estimatedMinutes,
            Boolean isFeatured,
            String certificateCriteria) {
    }

    private static final String TIME_STATUS = """
            CASE WHEN c.start_date > SYSUTCDATETIME() THEN N'UPCOMING' WHEN c.end_date < SYSUTCDATETIME() THEN N'ENDED' ELSE N'OPEN' END""";

    public PageResponse<CourseRow> list(String q, Long categoryId, Long organizationId, String level, String publishStatus,
            String timeStatus, int page, int size) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        Map<String, Object> p = new HashMap<>();
        String kw = Texts.normalize(q);
        if (!kw.isEmpty()) {
            where.append(" AND c.search_text LIKE N'%' + :kw + N'%' ESCAPE N'\\'");
            p.put("kw", Texts.escapeLike(kw));
        }
        if (categoryId != null) {
            where.append(" AND (cat.id = :cat OR cat.parent_id = :cat)");
            p.put("cat", categoryId);
        }
        if (organizationId != null) {
            where.append(" AND c.organization_id = :org");
            p.put("org", organizationId);
        }
        if (level != null && !level.isBlank()) {
            where.append(" AND c.course_level = :lvl");
            p.put("lvl", level);
        }
        if (publishStatus != null && !publishStatus.isBlank()) {
            where.append(" AND c.publish_status = :ps");
            p.put("ps", publishStatus);
        }
        if (timeStatus != null && !timeStatus.isBlank()) {
            where.append(" AND ").append(TIME_STATUS).append(" = :ts");
            p.put("ts", timeStatus);
        }
        String from = """
                 FROM dbo.courses c JOIN dbo.course_categories cat ON cat.id = c.category_id
                 JOIN dbo.course_categories par ON par.id = cat.parent_id JOIN dbo.organizations o ON o.id = c.organization_id""";
        long total = db.sql("SELECT COUNT(*)" + from + where).params(p).query(Long.class).single();
        p.put("off", page * size);
        p.put("size", size);
        List<CourseRow> items = db.sql("""
                SELECT c.id, c.slug, c.title, c.thumbnail_url, cat.name AS category_name, par.name AS parent_category_name,
                       o.name AS organization_name, c.course_level AS level, c.publish_status, %s AS time_status,
                       c.published_lesson_count, (SELECT COUNT(*) FROM dbo.lessons l WHERE l.course_id = c.id) AS lesson_count,
                       c.enrollment_count, c.learning_duration_days, c.is_featured, c.updated_at
                """.formatted(TIME_STATUS) + from + where + " ORDER BY c.updated_at DESC, c.id DESC OFFSET :off ROWS FETCH NEXT :size ROWS ONLY")
                .params(p).query(CourseRow.class).list();
        return PageResponse.of(items, page, size, total);
    }

    public CourseForm get(long id) {
        return db.sql("""
                SELECT c.id, c.slug, c.title, c.category_id, c.organization_id, c.course_level AS level, c.short_description,
                       c.description, c.outcomes, c.target_audience, c.prerequisites, c.thumbnail_url, c.start_date, c.end_date,
                       c.learning_duration_days, c.estimated_minutes, c.is_featured, c.certificate_criteria, c.publish_status,
                       %s AS time_status, c.published_at, c.enrollment_count,
                       (SELECT COUNT(*) FROM dbo.enrollments e WHERE e.course_id = c.id AND e.status = N'IN_PROGRESS'
                          AND e.expires_at > SYSUTCDATETIME()) AS active_learners,
                       c.published_lesson_count, c.updated_at
                FROM dbo.courses c WHERE c.id = :id""".formatted(TIME_STATUS))
                .param("id", id).query(CourseForm.class).optional()
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy khóa học"));
    }

    @Transactional
    public long create(CourseRequest r, long actorId) {
        validate(r);
        long id = db.sql("""
                INSERT INTO dbo.courses (category_id, organization_id, title, slug, short_description, description, outcomes,
                    target_audience, prerequisites, thumbnail_url, course_level, start_date, end_date, learning_duration_days,
                    estimated_minutes, is_featured, certificate_criteria, created_by)
                OUTPUT INSERTED.id
                VALUES (:cat, :org, :title, :slug, :short, :desc, :out, :aud, :pre, :thumb, :lvl, :start, :end, :days,
                    :mins, :feat, :cert, :by)""")
                .params(params(r, null)).param("by", actorId).query(Long.class).single();
        searchText.refreshCourse(id);
        audit.log(actorId, "CREATE", "COURSE", id, null, Map.of("title", r.title(), "learningDurationDays", days(r)));
        return id;
    }

    @Transactional
    public void update(long id, CourseRequest r, long actorId) {
        validate(r);
        CourseForm before = get(id);
        Map<String, Object> p = new HashMap<>(params(r, id));
        p.put("id", id);
        p.put("by", actorId);
        db.sql("""
                UPDATE dbo.courses SET category_id = :cat, organization_id = :org, title = :title, slug = :slug,
                    short_description = :short, description = :desc, outcomes = :out, target_audience = :aud,
                    prerequisites = :pre, thumbnail_url = :thumb, course_level = :lvl, start_date = :start, end_date = :end,
                    learning_duration_days = :days, estimated_minutes = :mins, is_featured = :feat, certificate_criteria = :cert,
                    updated_by = :by, updated_at = SYSUTCDATETIME(), version = version + 1
                WHERE id = :id""").params(p).update();
        searchText.refreshCourse(id);
        // FR-ADM-13: đổi ngày bắt đầu khóa "Sắp mở" → tính lại hạn cho lượt chưa đến ngày bắt đầu học.
        if (r.startDate() != null && !r.startDate().equals(before.startDate()) && r.startDate().isAfter(Instant.now())) {
            db.sql("""
                    UPDATE dbo.enrollments SET learning_started_at = :start,
                        expires_at = DATEADD(DAY, :days, :start), updated_at = SYSUTCDATETIME()
                    WHERE course_id = :id AND status = N'IN_PROGRESS' AND learning_started_at > SYSUTCDATETIME()""")
                    .param("start", Db.ts(r.startDate())).param("days", before.learningDurationDays()).param("id", id).update();
        }
        Map<String, Object> changes = new LinkedHashMap<>();
        Map<String, Object> old = new LinkedHashMap<>();
        if (before.learningDurationDays() != days(r)) {
            old.put("learningDurationDays", before.learningDurationDays());
            changes.put("learningDurationDays", days(r));
        }
        if (!before.title().equals(r.title())) {
            old.put("title", before.title());
            changes.put("title", r.title());
        }
        if (before.isFeatured() != Boolean.TRUE.equals(r.isFeatured())) {
            old.put("isFeatured", before.isFeatured());
            changes.put("isFeatured", Boolean.TRUE.equals(r.isFeatured()));
        }
        audit.log(actorId, "UPDATE", "COURSE", id, old, changes.isEmpty() ? Map.of("fields", "content") : changes);
    }

    private int days(CourseRequest r) {
        return r.learningDurationDays() == null ? props.learning().defaultDurationDays() : r.learningDurationDays();
    }

    private Map<String, Object> params(CourseRequest r, Long selfId) {
        Map<String, Object> p = new HashMap<>();
        p.put("cat", r.categoryId());
        p.put("org", r.organizationId());
        p.put("title", r.title().trim());
        p.put("slug", taxonomy.uniqueSlug("courses", r.slug() == null || r.slug().isBlank() ? r.title() : r.slug(), selfId));
        p.put("short", r.shortDescription().trim());
        p.put("desc", Html.sanitize(r.description()));
        p.put("out", Html.sanitize(r.outcomes()));
        p.put("aud", Html.sanitize(r.targetAudience()));
        p.put("pre", Html.sanitize(r.prerequisites()));
        p.put("thumb", Texts.trimToNull(r.thumbnailUrl()));
        p.put("lvl", r.level());
        p.put("start", Db.ts(r.startDate()));
        p.put("end", Db.ts(r.endDate()));
        p.put("days", days(r));
        p.put("mins", r.estimatedMinutes());
        p.put("feat", Boolean.TRUE.equals(r.isFeatured()));
        p.put("cert", Texts.trimToNull(r.certificateCriteria()));
        return p;
    }

    private void validate(CourseRequest r) {
        if (r.startDate() != null && r.endDate() != null && !r.endDate().isAfter(r.startDate())) {
            throw ApiException.validation("endDate", "Ngày kết thúc phải sau ngày bắt đầu");
        }
        Integer depth = db.sql("SELECT depth FROM dbo.course_categories WHERE id = :id").param("id", r.categoryId())
                .query(Integer.class).optional().orElseThrow(() -> ApiException.validation("categoryId", "Không tìm thấy loại khóa học"));
        if (depth != 2) {
            throw ApiException.validation("categoryId", "Khóa học chỉ được gắn vào loại cấp 2");
        }
        if (db.sql("SELECT COUNT(*) FROM dbo.organizations WHERE id = :id").param("id", r.organizationId()).query(Integer.class).single() == 0) {
            throw ApiException.validation("organizationId", "Không tìm thấy tổ chức đào tạo");
        }
    }

    // ------------------------------------------------------------- vòng đời xuất bản (FR-ADM-14)

    @Transactional
    public void publish(long id, long actorId) {
        CourseForm c = get(id);
        if ("PUBLISHED".equals(c.publishStatus())) {
            return;
        }
        if (c.thumbnailUrl() == null) {
            throw ApiException.unprocessable("COURSE_NOT_PUBLISHABLE", "Khóa học cần có ảnh bìa trước khi xuất bản");
        }
        if (c.publishedLessonCount() == 0) {
            throw ApiException.unprocessable("COURSE_NOT_PUBLISHABLE", "Khóa học cần có ít nhất 1 bài học đã xuất bản");
        }
        List<String> badQuizzes = db.sql("""
                SELECT l.title FROM dbo.lessons l JOIN dbo.quizzes q ON q.lesson_id = l.id
                WHERE l.course_id = :id AND l.is_published = 1
                  AND NOT EXISTS (SELECT 1 FROM dbo.questions x WHERE x.quiz_id = q.id AND x.is_active = 1
                                  AND EXISTS (SELECT 1 FROM dbo.question_options o WHERE o.question_id = x.id AND o.is_active = 1 AND o.is_correct = 1))""")
                .param("id", id).query(String.class).list();
        if (!badQuizzes.isEmpty()) {
            throw ApiException.unprocessable("COURSE_NOT_PUBLISHABLE", "Quiz của bài \"" + badQuizzes.get(0) + "\" chưa có câu hỏi hợp lệ");
        }
        db.sql("""
                UPDATE dbo.courses SET publish_status = N'PUBLISHED', published_at = COALESCE(published_at, SYSUTCDATETIME()),
                    updated_at = SYSUTCDATETIME(), version = version + 1 WHERE id = :id""").param("id", id).update();
        audit.log(actorId, c.publishStatus().equals("ARCHIVED") ? "RESTORE" : "PUBLISH", "COURSE", id,
                Map.of("publishStatus", c.publishStatus()), Map.of("publishStatus", "PUBLISHED"));
    }

    /** BR-ADM-07: chỉ gỡ về nháp khi chưa có học viên. */
    @Transactional
    public void unpublish(long id, long actorId) {
        if (hasEnrollments(id)) {
            throw ApiException.conflict("COURSE_HAS_ENROLLMENTS", "Khóa học đã có học viên nên không thể gỡ về bản nháp, chỉ có thể lưu trữ");
        }
        setStatus(id, "DRAFT", "UNPUBLISH", actorId);
    }

    @Transactional
    public void archive(long id, long actorId) {
        setStatus(id, "ARCHIVED", "ARCHIVE", actorId);
    }

    private void setStatus(long id, String status, String action, long actorId) {
        CourseForm c = get(id);
        db.sql("UPDATE dbo.courses SET publish_status = :s, updated_at = SYSUTCDATETIME(), version = version + 1 WHERE id = :id")
                .param("s", status).param("id", id).update();
        audit.log(actorId, action, "COURSE", id, Map.of("publishStatus", c.publishStatus()), Map.of("publishStatus", status));
    }

    /** BR-ADM-08: chỉ xóa khóa nháp chưa có học viên (xóa dây chuyền bài học, quiz). */
    @Transactional
    public void delete(long id, long actorId) {
        CourseForm c = get(id);
        if (!"DRAFT".equals(c.publishStatus()) || hasEnrollments(id)) {
            throw ApiException.conflict("COURSE_HAS_ENROLLMENTS", "Chỉ xóa được khóa học nháp chưa có học viên. Hãy dùng chức năng lưu trữ");
        }
        db.sql("DELETE FROM dbo.course_reviews WHERE course_id = :id").param("id", id).update();
        db.sql("DELETE FROM dbo.courses WHERE id = :id").param("id", id).update();
        audit.log(actorId, "DELETE", "COURSE", id, Map.of("title", c.title()), null);
    }

    private boolean hasEnrollments(long id) {
        return db.sql("SELECT COUNT(*) FROM dbo.enrollments WHERE course_id = :id").param("id", id).query(Integer.class).single() > 0;
    }

    // ------------------------------------------------------------- học viên & xếp hạng (FR-ADM-18, 19)

    public record EnrollmentRow(long userId, String fullName, String email, String status, int roundNo,
            int progressPercent, Instant enrolledAt, Instant expiresAt, Instant expiredAt, Instant completedAt,
            BigDecimal totalScore, Integer totalDurationSeconds) {
    }

    public PageResponse<EnrollmentRow> enrollments(long courseId, String status, String q, int page, int size) {
        String effective = """
                CASE WHEN e.status IN (N'IN_PROGRESS', N'CANCELLED') AND e.expires_at <= SYSUTCDATETIME() THEN N'EXPIRED' ELSE e.status END""";
        StringBuilder where = new StringBuilder(" WHERE e.course_id = :c");
        Map<String, Object> p = new HashMap<>(Map.of("c", courseId));
        if (status != null && !status.isBlank()) {
            where.append(" AND ").append(effective).append(" = :st");
            p.put("st", status);
        }
        if (q != null && !q.isBlank()) {
            where.append(" AND (u.full_name LIKE :q OR u.email LIKE :q)");
            p.put("q", "%" + q.trim() + "%");
        }
        String from = " FROM dbo.enrollments e JOIN dbo.users u ON u.id = e.user_id LEFT JOIN dbo.rankings r ON r.user_id = e.user_id AND r.course_id = e.course_id";
        long total = db.sql("SELECT COUNT(*)" + from + where).params(p).query(Long.class).single();
        p.put("off", page * size);
        p.put("size", size);
        List<EnrollmentRow> items = db.sql("SELECT u.id AS user_id, u.full_name, u.email, " + effective + """
                 AS status, e.round_no, e.progress_percent, e.enrolled_at, e.expires_at, e.expired_at, e.completed_at,
                       r.total_score, r.total_duration_seconds
                """ + from + where + " ORDER BY e.enrolled_at DESC OFFSET :off ROWS FETCH NEXT :size ROWS ONLY")
                .params(p).query(EnrollmentRow.class).list();
        return PageResponse.of(items, page, size, total);
    }

    /** FR-RNK-04: chấm lại toàn bộ và dựng lại bảng xếp hạng, chạy nền. */
    @Async
    public void recalculateRanking(long courseId, long actorId) {
        tx.executeWithoutResult(s -> {
            quizzes.regradeCourse(courseId);
            ranking.rebuild(courseId);
            audit.log(actorId, "RECALCULATE_RANKING", "COURSE", courseId, null, null);
        });
    }
}
