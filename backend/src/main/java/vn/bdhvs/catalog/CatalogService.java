package vn.bdhvs.catalog;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import vn.bdhvs.catalog.CatalogDtos.CategoryNode;
import vn.bdhvs.catalog.CatalogDtos.CategoryRef;
import vn.bdhvs.catalog.CatalogDtos.CourseCard;
import vn.bdhvs.catalog.CatalogDtos.CourseDetail;
import vn.bdhvs.catalog.CatalogDtos.FacetValue;
import vn.bdhvs.catalog.CatalogDtos.Facets;
import vn.bdhvs.catalog.CatalogDtos.HomeData;
import vn.bdhvs.catalog.CatalogDtos.LessonItem;
import vn.bdhvs.catalog.CatalogDtos.MyEnrollment;
import vn.bdhvs.catalog.CatalogDtos.OrganizationItem;
import vn.bdhvs.catalog.CatalogDtos.OrganizationRef;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.security.AuthUser;
import vn.bdhvs.common.util.Texts;
import vn.bdhvs.common.web.PageResponse;

/** Khám phá khóa học: SRS 03, truy vấn theo design-db 05 §1–2. */
@Service
public class CatalogService {

    private static final Set<String> LEVELS = Set.of("BASIC", "INTERMEDIATE", "ADVANCED");
    private static final Map<String, String> LEVEL_LABELS = Map.of("BASIC", "Cơ bản", "INTERMEDIATE", "Trung cấp",
            "ADVANCED", "Nâng cao");

    private final JdbcClient db;

    public CatalogService(JdbcClient db) {
        this.db = db;
    }

    /** Điều kiện lọc (FR-CRS-02). Các danh sách rỗng nghĩa là không lọc theo nhóm đó. */
    public record CourseFilter(String q, List<String> status, List<String> myStatus, List<String> category,
            List<String> level, List<Long> organization, String sort, Long userId) {
    }

    // ---------------------------------------------------------------- danh mục

    public List<CategoryNode> categories() {
        record Row(long id, Long parentId, String name, String slug, String description, String iconUrl, int courseCount) {
        }
        List<Row> rows = db.sql("""
                SELECT cc.id, cc.parent_id, cc.name, cc.slug, cc.description, cc.icon_url,
                       (SELECT COUNT(*) FROM dbo.courses c
                        JOIN dbo.course_categories k ON k.id = c.category_id
                        WHERE c.publish_status = N'PUBLISHED' AND (k.id = cc.id OR k.parent_id = cc.id)) AS course_count
                FROM dbo.course_categories cc
                LEFT JOIN dbo.course_categories p ON p.id = cc.parent_id
                WHERE cc.is_active = 1 AND (p.id IS NULL OR p.is_active = 1)
                ORDER BY cc.depth, cc.sort_order, cc.name""").query(Row.class).list();
        Map<Long, List<CategoryNode>> children = new HashMap<>();
        for (Row r : rows) {
            if (r.parentId() != null) {
                children.computeIfAbsent(r.parentId(), k -> new ArrayList<>()).add(
                        new CategoryNode(r.id(), r.name(), r.slug(), r.description(), r.iconUrl(), r.courseCount(), List.of()));
            }
        }
        return rows.stream().filter(r -> r.parentId() == null)
                .map(r -> new CategoryNode(r.id(), r.name(), r.slug(), r.description(), r.iconUrl(), r.courseCount(),
                        children.getOrDefault(r.id(), List.of())))
                .toList();
    }

    public List<OrganizationItem> organizations() {
        return db.sql("""
                SELECT o.id, o.name, o.slug, o.logo_url,
                       (SELECT COUNT(*) FROM dbo.courses c WHERE c.organization_id = o.id AND c.publish_status = N'PUBLISHED') AS course_count
                FROM dbo.organizations o WHERE o.is_active = 1 ORDER BY o.name""")
                .query(OrganizationItem.class).list();
    }

    // ---------------------------------------------------------------- tìm kiếm

    private static final class Where {
        final StringBuilder sql = new StringBuilder(" WHERE c.publish_status = N'PUBLISHED' AND cat.is_active = 1 AND par.is_active = 1");
        final Map<String, Object> params = new HashMap<>();
    }

    /** Ghép điều kiện cho các bộ lọc đã chọn; {@code skip} bỏ qua một nhóm khi đếm facet (design-db 05 §1.1). */
    private Where where(CourseFilter f, String skip) {
        Where w = new Where();
        w.params.put("uid", f.userId() == null ? -1L : f.userId());
        String kw = Texts.normalize(f.q());
        if (!kw.isEmpty()) {
            w.sql.append(" AND c.search_text LIKE N'%' + :kw + N'%' ESCAPE N'\\'");
            w.params.put("kw", Texts.escapeLike(kw.length() > 100 ? kw.substring(0, 100) : kw));
        }
        if (!"status".equals(skip) && notEmpty(f.status())) {
            List<String> parts = new ArrayList<>();
            if (f.status().contains("UPCOMING")) {
                parts.add("c.start_date > SYSUTCDATETIME()");
            }
            if (f.status().contains("OPEN")) {
                parts.add("((c.start_date IS NULL OR c.start_date <= SYSUTCDATETIME()) AND (c.end_date IS NULL OR c.end_date >= SYSUTCDATETIME()))");
            }
            if (f.status().contains("ENDED")) {
                parts.add("c.end_date < SYSUTCDATETIME()");
            }
            if (!parts.isEmpty()) {
                w.sql.append(" AND (").append(String.join(" OR ", parts)).append(")");
            }
        }
        if (!"myStatus".equals(skip) && notEmpty(f.myStatus()) && f.userId() != null) {
            List<String> parts = new ArrayList<>();
            if (f.myStatus().contains("NOT_ENROLLED")) {
                parts.add("""
                        NOT EXISTS (SELECT 1 FROM dbo.enrollments x WHERE x.course_id = c.id AND x.user_id = :uid
                                    AND x.status <> N'CANCELLED')""");
            }
            List<String> statuses = f.myStatus().stream()
                    .filter(s -> Set.of("IN_PROGRESS", "COMPLETED", "EXPIRED").contains(s)).toList();
            if (!statuses.isEmpty()) {
                parts.add("""
                        EXISTS (SELECT 1 FROM dbo.enrollments x WHERE x.course_id = c.id AND x.user_id = :uid
                                AND x.status IN (:mine))""");
                w.params.put("mine", statuses);
            }
            if (!parts.isEmpty()) {
                w.sql.append(" AND (").append(String.join(" OR ", parts)).append(")");
            }
        }
        if (!"category".equals(skip) && notEmpty(f.category())) {
            w.sql.append(" AND (cat.slug IN (:cats) OR par.slug IN (:cats))");
            w.params.put("cats", f.category());
        }
        if (!"level".equals(skip) && notEmpty(f.level())) {
            List<String> levels = f.level().stream().filter(LEVELS::contains).toList();
            if (!levels.isEmpty()) {
                w.sql.append(" AND c.course_level IN (:levels)");
                w.params.put("levels", levels);
            }
        }
        if (!"organization".equals(skip) && notEmpty(f.organization())) {
            w.sql.append(" AND c.organization_id IN (:orgs)");
            w.params.put("orgs", f.organization());
        }
        return w;
    }

    private static boolean notEmpty(List<?> l) {
        return l != null && !l.isEmpty();
    }

    public PageResponse<CourseCard> search(CourseFilter f, int page, int size) {
        Where w = where(f, null);
        String kw = (String) w.params.get("kw");
        String sort = f.sort() == null ? (kw != null ? "relevance" : "newest") : f.sort();
        String order = switch (sort) {
            case "relevance" -> kw == null ? "c.published_at DESC, c.id DESC"
                    : "CASE WHEN c.search_text LIKE :kw + N'%' ESCAPE N'\\' THEN 0 ELSE 1 END, c.enrollment_count DESC, c.id DESC";
            case "popular" -> "c.enrollment_count DESC, c.id DESC";
            case "rating" -> "c.rating_avg DESC, c.rating_count DESC, c.id DESC";
            case "title" -> "c.title ASC, c.id ASC";
            default -> "c.published_at DESC, c.id DESC";
        };
        long total = db.sql("""
                SELECT COUNT(*) FROM dbo.courses c
                JOIN dbo.course_categories cat ON cat.id = c.category_id
                JOIN dbo.course_categories par ON par.id = cat.parent_id""" + w.sql)
                .params(w.params).query(Long.class).single();
        w.params.put("offset", page * size);
        w.params.put("size", size);
        List<CourseCard> items = db.sql(CourseRows.CARD_SELECT + w.sql + " ORDER BY " + order
                + " OFFSET :offset ROWS FETCH NEXT :size ROWS ONLY")
                .params(w.params).query(CourseRows::card).list();
        return PageResponse.of(items, page, size, total);
    }

    /** FR-CRS-02: số khóa học theo từng giá trị lọc, áp dụng mọi bộ lọc khác trừ nhóm đang đếm. */
    public Facets facets(CourseFilter f) {
        Map<String, List<FacetValue>> groups = new LinkedHashMap<>();
        String from = """
                FROM dbo.courses c
                JOIN dbo.course_categories cat ON cat.id = c.category_id
                JOIN dbo.course_categories par ON par.id = cat.parent_id""";

        Where w = where(f, "status");
        record StatusCount(long upcoming, long open, long ended) {
        }
        StatusCount sc = db.sql("""
                SELECT SUM(CASE WHEN c.start_date > SYSUTCDATETIME() THEN 1 ELSE 0 END) AS upcoming_count,
                       SUM(CASE WHEN (c.start_date IS NULL OR c.start_date <= SYSUTCDATETIME())
                                 AND (c.end_date IS NULL OR c.end_date >= SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS open_count,
                       SUM(CASE WHEN c.end_date < SYSUTCDATETIME() THEN 1 ELSE 0 END) AS ended_count
                """ + from + w.sql).params(w.params).query((rs, i) -> new StatusCount(rs.getLong(1), rs.getLong(2), rs.getLong(3))).single();
        groups.put("status", List.of(new FacetValue("UPCOMING", "Sắp mở", sc.upcoming()),
                new FacetValue("OPEN", "Đang mở", sc.open()), new FacetValue("ENDED", "Đã kết thúc", sc.ended())));

        w = where(f, "level");
        Map<String, Long> levels = new HashMap<>();
        db.sql("SELECT c.course_level, COUNT(*) AS n " + from + w.sql + " GROUP BY c.course_level").params(w.params)
                .query((rs, i) -> levels.put(rs.getString(1), rs.getLong(2))).list();
        groups.put("level", List.of("BASIC", "INTERMEDIATE", "ADVANCED").stream()
                .map(l -> new FacetValue(l, LEVEL_LABELS.get(l), levels.getOrDefault(l, 0L))).toList());

        w = where(f, "category");
        groups.put("category", db.sql("""
                SELECT k.slug, k.name, SUM(n) AS n FROM (
                    SELECT cat.id AS cid, par.id AS pid, COUNT(*) AS n
                """ + from + w.sql + """
                    GROUP BY cat.id, par.id) t
                JOIN dbo.course_categories k ON k.id = t.cid OR k.id = t.pid
                GROUP BY k.slug, k.name""").params(w.params)
                .query((rs, i) -> new FacetValue(rs.getString(1), rs.getString(2), rs.getLong(3))).list());

        w = where(f, "organization");
        groups.put("organization", db.sql("SELECT CAST(o.id AS NVARCHAR(20)), o.name, COUNT(*) " + from
                + " JOIN dbo.organizations o ON o.id = c.organization_id" + w.sql + " GROUP BY o.id, o.name ORDER BY o.name")
                .params(w.params).query((rs, i) -> new FacetValue(rs.getString(1), rs.getString(2), rs.getLong(3))).list());

        if (f.userId() != null) {
            w = where(f, "myStatus");
            record Mine(long notEnrolled, long inProgress, long completed, long expired) {
            }
            Mine m = db.sql("""
                    SELECT SUM(CASE WHEN e.id IS NULL OR e.status = N'CANCELLED' THEN 1 ELSE 0 END),
                           SUM(CASE WHEN e.status = N'IN_PROGRESS' THEN 1 ELSE 0 END),
                           SUM(CASE WHEN e.status = N'COMPLETED' THEN 1 ELSE 0 END),
                           SUM(CASE WHEN e.status = N'EXPIRED' THEN 1 ELSE 0 END)
                    """ + from + " LEFT JOIN dbo.enrollments e ON e.course_id = c.id AND e.user_id = :uid" + w.sql)
                    .params(w.params).query((rs, i) -> new Mine(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4))).single();
            groups.put("myStatus", List.of(new FacetValue("NOT_ENROLLED", "Chưa đăng ký", m.notEnrolled()),
                    new FacetValue("IN_PROGRESS", "Đang học", m.inProgress()),
                    new FacetValue("COMPLETED", "Đã hoàn thành", m.completed()),
                    new FacetValue("EXPIRED", "Hết hạn", m.expired())));
        }
        return new Facets(groups);
    }

    /** SCR-CRS-04: khóa học đã ghi danh, lọc theo trạng thái hiệu lực (lượt quá hạn tính là EXPIRED). */
    public PageResponse<CourseCard> myCourses(long userId, List<String> statuses, int page, int size) {
        String effective = """
                CASE WHEN e.status IN (N'IN_PROGRESS', N'CANCELLED') AND e.expires_at <= SYSUTCDATETIME() THEN N'EXPIRED'
                     ELSE e.status END""";
        String where = " WHERE e.id IS NOT NULL AND " + effective + " IN (:st)";
        Map<String, Object> p = new HashMap<>(Map.of("uid", userId, "st", statuses));
        long total = db.sql("SELECT COUNT(*) FROM dbo.enrollments e WHERE e.user_id = :uid AND " + effective + " IN (:st)")
                .params(p).query(Long.class).single();
        p.put("offset", page * size);
        p.put("size", size);
        List<CourseCard> items = db.sql(CourseRows.CARD_SELECT + where + """
                 ORDER BY CASE %s WHEN N'IN_PROGRESS' THEN 0 WHEN N'COMPLETED' THEN 1 ELSE 2 END,
                          e.expires_at ASC, e.updated_at DESC
                 OFFSET :offset ROWS FETCH NEXT :size ROWS ONLY""".formatted(effective))
                .params(p).query(CourseRows::card).list();
        return PageResponse.of(items, page, size, total);
    }

    public HomeData home(Long userId) {
        Map<String, Object> p = Map.of("uid", userId == null ? -1L : userId);
        String base = CourseRows.CARD_SELECT + " WHERE c.publish_status = N'PUBLISHED' AND cat.is_active = 1 AND par.is_active = 1";
        List<CourseCard> featured = db.sql(base + " AND c.is_featured = 1 ORDER BY c.enrollment_count DESC, c.id DESC OFFSET 0 ROWS FETCH NEXT 8 ROWS ONLY")
                .params(p).query(CourseRows::card).list();
        List<CourseCard> newest = db.sql(base + " ORDER BY c.published_at DESC, c.id DESC OFFSET 0 ROWS FETCH NEXT 8 ROWS ONLY")
                .params(p).query(CourseRows::card).list();
        Map<String, Long> stats = new LinkedHashMap<>();
        db.sql("""
                SELECT (SELECT COUNT(*) FROM dbo.courses WHERE publish_status = N'PUBLISHED') AS courses,
                       (SELECT COUNT(DISTINCT user_id) FROM dbo.enrollments) AS learners,
                       (SELECT COUNT(*) FROM dbo.organizations WHERE is_active = 1) AS organizations,
                       (SELECT CAST(ISNULL(AVG(CAST(rating AS DECIMAL(5,2))), 0) * 100 AS BIGINT) FROM dbo.course_reviews WHERE is_hidden = 0) AS rating_x100""")
                .query((rs, i) -> {
                    stats.put("courses", rs.getLong(1));
                    stats.put("learners", rs.getLong(2));
                    stats.put("organizations", rs.getLong(3));
                    stats.put("ratingX100", rs.getLong(4));
                    return null;
                }).list();
        return new HomeData(featured, newest, categories(), stats);
    }

    // ---------------------------------------------------------------- chi tiết

    record CourseHead(long id, String publishStatus, int learningDurationDays, Instant startDate, Instant endDate,
            String title) {
    }

    /** BR-CRS-04: DRAFT chỉ Admin xem; ARCHIVED Admin và người đã ghi danh xem được. */
    public CourseHead visibleCourse(String slug, AuthUser user) {
        CourseHead c = db.sql("SELECT id, publish_status, learning_duration_days, start_date, end_date, title FROM dbo.courses WHERE slug = :slug")
                .param("slug", slug).query(CourseHead.class).optional()
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy khóa học"));
        if ("PUBLISHED".equals(c.publishStatus()) || (user != null && user.isAdmin())) {
            return c;
        }
        if ("ARCHIVED".equals(c.publishStatus()) && user != null) {
            boolean enrolled = db.sql("SELECT COUNT(*) FROM dbo.enrollments WHERE course_id = :c AND user_id = :u AND status <> N'CANCELLED'")
                    .param("c", c.id()).param("u", user.id()).query(Integer.class).single() > 0;
            if (enrolled) {
                return c;
            }
        }
        throw ApiException.notFound("Không tìm thấy khóa học");
    }

    public CourseDetail detail(String slug, AuthUser user) {
        CourseHead head = visibleCourse(slug, user);
        Map<String, Object> p = Map.of("id", head.id(), "uid", user == null ? -1L : user.id());
        return db.sql("""
                SELECT c.id, c.slug, c.title, c.short_description, c.description, c.outcomes, c.target_audience, c.prerequisites,
                       c.thumbnail_url, c.course_level, c.publish_status, %s AS time_status, c.start_date, c.end_date,
                       c.published_lesson_count,
                   COALESCE(c.estimated_minutes, (SELECT SUM(lx.estimated_minutes) FROM dbo.lessons lx WHERE lx.course_id = c.id AND lx.is_published = 1)) AS estimated_minutes,
                   c.enrollment_count, c.rating_avg, c.rating_count,
                       c.learning_duration_days, c.certificate_criteria,
                       o.id AS org_id, o.name AS org_name, o.slug AS org_slug, o.logo_url AS org_logo, o.description AS org_desc,
                       (SELECT COUNT(*) FROM dbo.courses x WHERE x.organization_id = o.id AND x.publish_status = N'PUBLISHED') AS org_courses,
                       cat.id AS cat_id, cat.name AS cat_name, cat.slug AS cat_slug, par.id AS par_id, par.name AS par_name, par.slug AS par_slug,
                       e.id AS e_id, e.status AS e_status, e.progress_percent AS e_progress, e.completed_lesson_count AS e_done,
                       e.learning_started_at AS e_started, e.expires_at AS e_expires, e.expired_at AS e_expired,
                       e.completed_at AS e_completed, e.round_no AS e_round, e.last_lesson_id AS e_last
                FROM dbo.courses c
                JOIN dbo.organizations o ON o.id = c.organization_id
                JOIN dbo.course_categories cat ON cat.id = c.category_id
                JOIN dbo.course_categories par ON par.id = cat.parent_id
                LEFT JOIN dbo.enrollments e ON e.course_id = c.id AND e.user_id = :uid
                WHERE c.id = :id""".formatted(CourseRows.TIME_STATUS))
                .params(p).query((rs, i) -> {
                    MyEnrollment me = CourseRows.enrollment(rs);
                    return new CourseDetail(rs.getLong("id"), rs.getString("slug"), rs.getString("title"),
                            rs.getString("short_description"), rs.getString("description"), rs.getString("outcomes"),
                            rs.getString("target_audience"), rs.getString("prerequisites"), rs.getString("thumbnail_url"),
                            rs.getString("course_level"), rs.getString("publish_status"), rs.getString("time_status"),
                            CourseRows.instant(rs, "start_date"), CourseRows.instant(rs, "end_date"),
                            rs.getInt("published_lesson_count"), CourseRows.intOrNull(rs, "estimated_minutes"),
                            rs.getInt("enrollment_count"), rs.getBigDecimal("rating_avg"), rs.getInt("rating_count"),
                            rs.getInt("learning_duration_days"), rs.getString("certificate_criteria"),
                            new OrganizationRef(rs.getLong("org_id"), rs.getString("org_name"), rs.getString("org_slug"),
                                    rs.getString("org_logo"), rs.getString("org_desc"), rs.getInt("org_courses")),
                            new CategoryRef(rs.getLong("cat_id"), rs.getString("cat_name"), rs.getString("cat_slug")),
                            new CategoryRef(rs.getLong("par_id"), rs.getString("par_name"), rs.getString("par_slug")),
                            me, false);
                }).single()
                .withCanReview(user != null && canReview(head.id(), user.id()));
    }

    /** BR-CRS-03: đã ghi danh và hoàn thành ít nhất 1 bài. */
    public boolean canReview(long courseId, long userId) {
        return db.sql("""
                SELECT COUNT(*) FROM dbo.enrollments e
                JOIN dbo.lesson_progress lp ON lp.enrollment_id = e.id AND lp.status = N'COMPLETED'
                WHERE e.course_id = :c AND e.user_id = :u AND e.status IN (N'IN_PROGRESS', N'COMPLETED')""")
                .param("c", courseId).param("u", userId).query(Integer.class).single() > 0;
    }

    /** FR-CRS-06 / design-db 05 §2: giáo trình kèm trạng thái mở khóa của người học. */
    public List<LessonItem> lessons(String slug, AuthUser user) {
        CourseHead head = visibleCourse(slug, user);
        Long enrollmentId = null;
        if (user != null) {
            record E(long id, String status, Instant expiresAt) {
            }
            enrollmentId = db.sql("SELECT id, status, expires_at FROM dbo.enrollments WHERE course_id = :c AND user_id = :u")
                    .param("c", head.id()).param("u", user.id()).query(E.class).optional()
                    .filter(e -> {
                        String s = CourseRows.effectiveStatus(e.status(), e.expiresAt());
                        return "IN_PROGRESS".equals(s) || "COMPLETED".equals(s);
                    })
                    .map(E::id).orElse(null);
        }
        return lessonStates(head.id(), enrollmentId);
    }

    public List<LessonItem> lessonStates(long courseId, Long enrollmentId) {
        boolean enrolled = enrollmentId != null;
        return db.sql("""
                WITH l AS (
                    SELECT l.id, l.title, l.order_index, l.estimated_minutes, q.id AS quiz_id, lp.status AS progress_status,
                           SUM(CASE WHEN lp.status = N'COMPLETED' THEN 0 ELSE 1 END)
                               OVER (ORDER BY l.order_index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS incomplete_before,
                           (SELECT MAX(a.score_percent) FROM dbo.quiz_attempts a
                            WHERE a.quiz_id = q.id AND a.enrollment_id = :eid AND a.status IN (N'SUBMITTED', N'EXPIRED')) AS best_percent
                    FROM dbo.lessons l
                    LEFT JOIN dbo.quizzes q ON q.lesson_id = l.id
                    LEFT JOIN dbo.lesson_progress lp ON lp.lesson_id = l.id AND lp.enrollment_id = :eid
                    WHERE l.course_id = :cid AND l.is_published = 1
                )
                SELECT id, title, order_index, estimated_minutes, quiz_id, best_percent,
                       CASE WHEN progress_status = N'COMPLETED' THEN N'COMPLETED'
                            WHEN progress_status = N'IN_PROGRESS' THEN N'IN_PROGRESS'
                            WHEN ISNULL(incomplete_before, 0) = 0 THEN N'UNLOCKED'
                            ELSE N'LOCKED' END AS lesson_state
                FROM l ORDER BY order_index""")
                .param("cid", courseId).param("eid", enrolled ? enrollmentId : -1L)
                .query((rs, i) -> {
                    BigDecimal best = rs.getBigDecimal("best_percent");
                    return new LessonItem(rs.getLong("id"), rs.getInt("order_index"), rs.getString("title"),
                            CourseRows.intOrNull(rs, "estimated_minutes"), rs.getObject("quiz_id") != null,
                            enrolled ? rs.getString("lesson_state") : null, best == null ? null : best.intValue());
                }).list();
    }
}
