package vn.bdhvs.catalog;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;

import vn.bdhvs.catalog.CatalogDtos.CourseCard;
import vn.bdhvs.catalog.CatalogDtos.MyEnrollment;

/** Phần SELECT và ánh xạ dùng chung cho thẻ khóa học. */
final class CourseRows {

    private CourseRows() {
    }

    static final String TIME_STATUS = """
            CASE WHEN c.start_date > SYSUTCDATETIME() THEN N'UPCOMING'
                 WHEN c.end_date < SYSUTCDATETIME() THEN N'ENDED' ELSE N'OPEN' END""";

    static final String CARD_SELECT = """
            SELECT c.id, c.slug, c.title, c.short_description, c.thumbnail_url, c.course_level, c.start_date, c.end_date,
                   c.published_lesson_count,
                   COALESCE(c.estimated_minutes, (SELECT SUM(lx.estimated_minutes) FROM dbo.lessons lx WHERE lx.course_id = c.id AND lx.is_published = 1)) AS estimated_minutes,
                   c.enrollment_count, c.rating_avg, c.rating_count,
                   c.learning_duration_days,
                   o.id AS org_id, o.name AS org_name,
                   cat.id AS cat_id, cat.name AS cat_name, cat.slug AS cat_slug, par.id AS par_id, par.name AS par_name,
                   %s AS time_status,
                   e.id AS e_id, e.status AS e_status, e.progress_percent AS e_progress, e.completed_lesson_count AS e_done,
                   e.learning_started_at AS e_started, e.expires_at AS e_expires, e.expired_at AS e_expired,
                   e.completed_at AS e_completed, e.round_no AS e_round, e.last_lesson_id AS e_last
            FROM dbo.courses c
            JOIN dbo.organizations o ON o.id = c.organization_id
            JOIN dbo.course_categories cat ON cat.id = c.category_id
            JOIN dbo.course_categories par ON par.id = cat.parent_id
            LEFT JOIN dbo.enrollments e ON e.course_id = c.id AND e.user_id = :uid
            """.formatted(TIME_STATUS);

    static Instant instant(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }

    static Integer intOrNull(ResultSet rs, String col) throws SQLException {
        int v = rs.getInt(col);
        return rs.wasNull() ? null : v;
    }

    /**
     * Trạng thái hiệu lực: lượt chưa hoàn thành đã quá expires_at được coi là EXPIRED ngay,
     * không chờ job dọn dữ liệu (BR-LRN-10).
     */
    static String effectiveStatus(String status, Instant expiresAt) {
        if (("IN_PROGRESS".equals(status) || "CANCELLED".equals(status)) && expiresAt != null
                && !expiresAt.isAfter(Instant.now())) {
            return "EXPIRED";
        }
        return status;
    }

    static MyEnrollment enrollment(ResultSet rs) throws SQLException {
        long id = rs.getLong("e_id");
        if (rs.wasNull()) {
            return null;
        }
        Instant expires = instant(rs, "e_expires");
        String status = effectiveStatus(rs.getString("e_status"), expires);
        boolean expired = "EXPIRED".equals(status);
        return new MyEnrollment(id, status, expired ? 0 : rs.getInt("e_progress"), expired ? 0 : rs.getInt("e_done"),
                instant(rs, "e_started"), expires, instant(rs, "e_expired"), instant(rs, "e_completed"),
                rs.getInt("e_round"), expired ? null : (Long) rs.getObject("e_last", Long.class));
    }

    static CourseCard card(ResultSet rs, int row) throws SQLException {
        return new CourseCard(rs.getLong("id"), rs.getString("slug"), rs.getString("title"),
                rs.getString("short_description"), rs.getString("thumbnail_url"), rs.getString("course_level"),
                rs.getString("time_status"), instant(rs, "start_date"), instant(rs, "end_date"),
                rs.getInt("published_lesson_count"), intOrNull(rs, "estimated_minutes"), rs.getInt("enrollment_count"),
                rs.getBigDecimal("rating_avg"), rs.getInt("rating_count"), rs.getInt("learning_duration_days"),
                rs.getLong("org_id"), rs.getString("org_name"), rs.getLong("cat_id"), rs.getString("cat_name"),
                rs.getString("cat_slug"), rs.getLong("par_id"), rs.getString("par_name"), enrollment(rs));
    }
}
