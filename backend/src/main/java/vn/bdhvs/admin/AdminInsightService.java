package vn.bdhvs.admin;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.bdhvs.catalog.ReviewService;
import vn.bdhvs.common.audit.AuditService;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.util.Db;
import vn.bdhvs.common.web.PageResponse;

/** Dashboard (FR-ADM-21), kiểm duyệt đánh giá (FR-ADM-20), nhật ký thao tác (FR-ADM-22). */
@Service
public class AdminInsightService {

    private static final ZoneOffset VN = ZoneOffset.ofHours(7);

    private final JdbcClient db;
    private final AuditService audit;
    private final ReviewService reviews;

    public AdminInsightService(JdbcClient db, AuditService audit, ReviewService reviews) {
        this.db = db;
        this.audit = audit;
        this.reviews = reviews;
    }

    // ============================================================ dashboard

    public record DailyPoint(LocalDate day, long newUsers, long enrollments) {
    }

    public record TopCourse(long id, String title, String slug, int enrollmentCount) {
    }

    public record RecentAudit(Instant createdAt, String actorName, String actionType, String entityType, Long entityId) {
    }

    public record Dashboard(Map<String, Long> stats, List<DailyPoint> daily, List<TopCourse> topCourses,
            List<RecentAudit> recentAudit) {
    }

    public Dashboard dashboard() {
        Map<String, Long> stats = new LinkedHashMap<>();
        db.sql("""
                SELECT
                  (SELECT COUNT(*) FROM dbo.users WHERE deleted_at IS NULL AND status <> N'PENDING_VERIFICATION'),
                  (SELECT COUNT(*) FROM dbo.users WHERE deleted_at IS NULL AND created_at >= DATEADD(DAY, -7, SYSUTCDATETIME())),
                  (SELECT COUNT(*) FROM dbo.courses WHERE publish_status = N'PUBLISHED'),
                  (SELECT COUNT(*) FROM dbo.courses WHERE publish_status = N'PUBLISHED' AND start_date > SYSUTCDATETIME()),
                  (SELECT COUNT(*) FROM dbo.enrollments WHERE status <> N'CANCELLED'),
                  (SELECT COUNT(*) FROM dbo.enrollments WHERE enrolled_at >= DATEADD(DAY, -30, SYSUTCDATETIME())),
                  (SELECT COUNT(*) FROM dbo.enrollments WHERE status = N'COMPLETED'),
                  (SELECT COUNT(*) FROM dbo.enrollments WHERE status = N'EXPIRED' AND expired_at >= DATEADD(DAY, -30, SYSUTCDATETIME())),
                  (SELECT COUNT(*) FROM dbo.course_reviews WHERE is_hidden = 0 AND rating <= 2 AND created_at >= DATEADD(DAY, -7, SYSUTCDATETIME()))
                """).query((rs, i) -> {
            String[] keys = {"totalUsers", "newUsers7d", "publishedCourses", "upcomingCourses", "totalEnrollments",
                    "newEnrollments30d", "completedEnrollments", "expiredEnrollments30d", "lowRatingReviews7d"};
            for (int k = 0; k < keys.length; k++) {
                stats.put(keys[k], rs.getLong(k + 1));
            }
            return null;
        }).list();
        Map<LocalDate, long[]> days = new LinkedHashMap<>();
        LocalDate today = LocalDate.now(VN);
        for (int i = 29; i >= 0; i--) {
            days.put(today.minusDays(i), new long[2]);
        }
        db.sql("""
                SELECT CAST(DATEADD(HOUR, 7, created_at) AS DATE), COUNT(*) FROM dbo.users
                WHERE deleted_at IS NULL AND created_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
                GROUP BY CAST(DATEADD(HOUR, 7, created_at) AS DATE)""")
                .query((rs, i) -> {
                    long[] v = days.get(rs.getDate(1).toLocalDate());
                    if (v != null) {
                        v[0] = rs.getLong(2);
                    }
                    return null;
                }).list();
        db.sql("""
                SELECT CAST(DATEADD(HOUR, 7, enrolled_at) AS DATE), COUNT(*) FROM dbo.enrollments
                WHERE enrolled_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
                GROUP BY CAST(DATEADD(HOUR, 7, enrolled_at) AS DATE)""")
                .query((rs, i) -> {
                    long[] v = days.get(rs.getDate(1).toLocalDate());
                    if (v != null) {
                        v[1] = rs.getLong(2);
                    }
                    return null;
                }).list();
        List<DailyPoint> daily = days.entrySet().stream().map(e -> new DailyPoint(e.getKey(), e.getValue()[0], e.getValue()[1])).toList();
        List<TopCourse> top = db.sql("""
                SELECT TOP (5) id, title, slug, enrollment_count FROM dbo.courses WHERE publish_status = N'PUBLISHED'
                ORDER BY enrollment_count DESC, id""").query(TopCourse.class).list();
        List<RecentAudit> recent = db.sql("""
                SELECT TOP (5) a.created_at, COALESCE(u.full_name, N'Hệ thống') AS actor_name, a.action_type, a.entity_type, a.entity_id
                FROM dbo.audit_logs a LEFT JOIN dbo.users u ON u.id = a.actor_id ORDER BY a.created_at DESC, a.id DESC""")
                .query(RecentAudit.class).list();
        return new Dashboard(stats, daily, top, recent);
    }

    // ============================================================ đánh giá

    public record ReviewAdmin(long id, long courseId, String courseTitle, String courseSlug, long userId, String authorName,
            int rating, String comment, boolean isHidden, String hiddenReason, String hiddenByName, Instant hiddenAt,
            Instant createdAt) {
    }

    public PageResponse<ReviewAdmin> reviews(Long courseId, List<Integer> ratings, Boolean hidden, String q, int page, int size) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        Map<String, Object> p = new HashMap<>();
        if (courseId != null) {
            where.append(" AND r.course_id = :c");
            p.put("c", courseId);
        }
        if (ratings != null && !ratings.isEmpty()) {
            where.append(" AND r.rating IN (:ratings)");
            p.put("ratings", ratings);
        }
        if (hidden != null) {
            where.append(" AND r.is_hidden = :h");
            p.put("h", hidden);
        }
        if (q != null && !q.isBlank()) {
            where.append(" AND (r.comment LIKE :q OR u.full_name LIKE :q)");
            p.put("q", "%" + q.trim() + "%");
        }
        String from = " FROM dbo.course_reviews r JOIN dbo.users u ON u.id = r.user_id JOIN dbo.courses c ON c.id = r.course_id"
                + " LEFT JOIN dbo.users h ON h.id = r.hidden_by";
        long total = db.sql("SELECT COUNT(*)" + from + where).params(p).query(Long.class).single();
        p.put("off", page * size);
        p.put("size", size);
        List<ReviewAdmin> items = db.sql("""
                SELECT r.id, r.course_id, c.title AS course_title, c.slug AS course_slug, r.user_id, u.full_name AS author_name,
                       r.rating, r.comment, r.is_hidden, r.hidden_reason, h.full_name AS hidden_by_name, r.hidden_at, r.created_at
                """ + from + where + " ORDER BY r.created_at DESC, r.id DESC OFFSET :off ROWS FETCH NEXT :size ROWS ONLY")
                .params(p).query(ReviewAdmin.class).list();
        return PageResponse.of(items, page, size, total);
    }

    public Map<String, Long> reviewCounts() {
        Map<String, Long> m = new LinkedHashMap<>();
        db.sql("SELECT COUNT(*), ISNULL(SUM(CASE WHEN is_hidden = 0 THEN 1 ELSE 0 END), 0), ISNULL(SUM(CASE WHEN is_hidden = 1 THEN 1 ELSE 0 END), 0) FROM dbo.course_reviews")
                .query((rs, i) -> {
                    m.put("all", rs.getLong(1));
                    m.put("visible", rs.getLong(2));
                    m.put("hidden", rs.getLong(3));
                    return null;
                }).list();
        return m;
    }

    @Transactional
    public void hideReview(long id, String reason, long actorId) {
        if (reason == null || reason.isBlank()) {
            throw ApiException.validation("reason", "Vui lòng nhập lý do ẩn đánh giá");
        }
        long courseId = courseOfReview(id);
        db.sql("""
                UPDATE dbo.course_reviews SET is_hidden = 1, hidden_reason = :r, hidden_by = :by, hidden_at = SYSUTCDATETIME(),
                    updated_at = SYSUTCDATETIME() WHERE id = :id""")
                .param("r", reason.trim()).param("by", actorId).param("id", id).update();
        reviews.refreshAggregate(courseId);
        audit.log(actorId, "HIDE", "COURSE_REVIEW", id, null, Map.of("reason", reason.trim()));
    }

    @Transactional
    public void showReview(long id, String reason, long actorId) {
        long courseId = courseOfReview(id);
        db.sql("""
                UPDATE dbo.course_reviews SET is_hidden = 0, hidden_reason = NULL, hidden_by = NULL, hidden_at = NULL,
                    updated_at = SYSUTCDATETIME() WHERE id = :id""").param("id", id).update();
        reviews.refreshAggregate(courseId);
        audit.log(actorId, "SHOW", "COURSE_REVIEW", id, null, reason == null ? null : Map.of("reason", reason));
    }

    private long courseOfReview(long id) {
        return db.sql("SELECT course_id FROM dbo.course_reviews WHERE id = :id").param("id", id).query(Long.class)
                .optional().orElseThrow(() -> ApiException.notFound("Không tìm thấy đánh giá"));
    }

    // ============================================================ nhật ký

    public record AuditRow(long id, Instant createdAt, Long actorId, String actorName, String actionType,
            String entityType, Long entityId, String beforeData, String afterData, String ipAddress) {
    }

    public PageResponse<AuditRow> auditLogs(Long actorId, String entityType, String actionType, LocalDate from,
            LocalDate to, int page, int size) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        Map<String, Object> p = new HashMap<>();
        if (actorId != null) {
            where.append(" AND a.actor_id = :actor");
            p.put("actor", actorId);
        }
        if (entityType != null && !entityType.isBlank()) {
            where.append(" AND a.entity_type = :et");
            p.put("et", entityType);
        }
        if (actionType != null && !actionType.isBlank()) {
            where.append(" AND a.action_type = :at");
            p.put("at", actionType);
        }
        if (from != null) {
            where.append(" AND a.created_at >= :from");
            p.put("from", Db.ts(from.atStartOfDay().toInstant(VN)));
        }
        if (to != null) {
            where.append(" AND a.created_at < :to");
            p.put("to", Db.ts(to.plusDays(1).atStartOfDay().toInstant(VN)));
        }
        String fromSql = " FROM dbo.audit_logs a LEFT JOIN dbo.users u ON u.id = a.actor_id";
        long total = db.sql("SELECT COUNT(*)" + fromSql + where).params(p).query(Long.class).single();
        p.put("off", page * size);
        p.put("size", size);
        List<AuditRow> items = db.sql("""
                SELECT a.id, a.created_at, a.actor_id, COALESCE(u.full_name, N'Hệ thống') AS actor_name, a.action_type,
                       a.entity_type, a.entity_id, a.before_data, a.after_data, a.ip_address""" + fromSql + where
                + " ORDER BY a.created_at DESC, a.id DESC OFFSET :off ROWS FETCH NEXT :size ROWS ONLY")
                .params(p).query(AuditRow.class).list();
        return PageResponse.of(items, page, size, total);
    }

    public record Actor(long id, String fullName) {
    }

    public List<Actor> auditActors() {
        return db.sql("""
                SELECT DISTINCT u.id, u.full_name FROM dbo.audit_logs a JOIN dbo.users u ON u.id = a.actor_id ORDER BY u.full_name""")
                .query(Actor.class).list();
    }
}
