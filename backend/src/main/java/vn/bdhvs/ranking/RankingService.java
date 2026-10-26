package vn.bdhvs.ranking;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import vn.bdhvs.catalog.CatalogDtos.MyRank;
import vn.bdhvs.catalog.CatalogDtos.RankingRow;
import vn.bdhvs.common.util.Db;
import vn.bdhvs.common.web.PageResponse;

/** Xếp hạng theo khóa học: BR-RNK-01..03, SQL theo design-db 05 §6. */
@Service
public class RankingService {

    private final JdbcClient db;

    public RankingService(JdbcClient db) {
        this.db = db;
    }

    /** Người được xếp hạng: enrollment còn hiệu lực, có điểm, tài khoản hoạt động, không phải Admin (BR-RNK-03). */
    private static final String ELIGIBLE = """
            WITH eligible AS (
                SELECT r.user_id, r.total_score, r.total_duration_seconds, r.completed_quiz_count, r.last_achieved_at,
                       u.full_name, u.avatar_url, u.show_on_leaderboard
                FROM dbo.rankings r
                JOIN dbo.users u ON u.id = r.user_id
                JOIN dbo.enrollments e ON e.user_id = r.user_id AND e.course_id = r.course_id
                WHERE r.course_id = :cid AND r.total_score > 0
                  AND e.status IN (N'IN_PROGRESS', N'COMPLETED')
                  AND (e.status = N'COMPLETED' OR e.expires_at > SYSUTCDATETIME())
                  AND u.status = N'ACTIVE' AND u.deleted_at IS NULL
                  AND NOT EXISTS (SELECT 1 FROM dbo.user_roles ur JOIN dbo.roles ro ON ro.id = ur.role_id
                                  WHERE ur.user_id = u.id AND ro.code = N'ADMIN')
            ),
            ranked AS (
                SELECT *, RANK() OVER (ORDER BY total_score DESC, total_duration_seconds ASC, last_achieved_at ASC) AS rank_no
                FROM eligible
            )
            """;

    /** FR-RNK-03 / design-db 05 §6.1–6.2: gọi trong transaction nộp bài. */
    public void onAttemptGraded(long userId, long courseId, long quizId, long attemptId, BigDecimal score,
            int durationSeconds, Instant submittedAt) {
        int updated = db.sql("""
                UPDATE dbo.quiz_best_attempts WITH (UPDLOCK, SERIALIZABLE)
                SET attempt_id = :aid, score = :score, duration_seconds = :dur, achieved_at = :at, updated_at = SYSUTCDATETIME()
                WHERE user_id = :uid AND quiz_id = :qid
                  AND (:score > score OR (:score = score AND :dur < duration_seconds))""")
                .param("aid", attemptId).param("score", score).param("dur", durationSeconds)
                .param("at", Db.ts(submittedAt)).param("uid", userId).param("qid", quizId).update();
        if (updated == 0) {
            db.sql("""
                    INSERT INTO dbo.quiz_best_attempts (user_id, quiz_id, course_id, attempt_id, score, duration_seconds, achieved_at)
                    SELECT :uid, :qid, :cid, :aid, :score, :dur, :at
                    WHERE NOT EXISTS (SELECT 1 FROM dbo.quiz_best_attempts WITH (UPDLOCK, SERIALIZABLE)
                                      WHERE user_id = :uid AND quiz_id = :qid)""")
                    .param("uid", userId).param("qid", quizId).param("cid", courseId).param("aid", attemptId)
                    .param("score", score).param("dur", durationSeconds).param("at", Db.ts(submittedAt)).update();
        }
        recomputeTotals(userId, courseId);
    }

    public void recomputeTotals(long userId, long courseId) {
        int n = db.sql("""
                UPDATE r SET total_score = x.total, total_duration_seconds = x.dur, completed_quiz_count = x.cnt,
                    last_achieved_at = x.last_at, updated_at = SYSUTCDATETIME()
                FROM dbo.rankings r WITH (UPDLOCK, SERIALIZABLE)
                CROSS APPLY (SELECT ISNULL(SUM(score), 0) AS total, ISNULL(SUM(duration_seconds), 0) AS dur,
                                    COUNT(*) AS cnt, MAX(achieved_at) AS last_at
                             FROM dbo.quiz_best_attempts WHERE user_id = :uid AND course_id = :cid) x
                WHERE r.user_id = :uid AND r.course_id = :cid""")
                .param("uid", userId).param("cid", courseId).update();
        if (n == 0) {
            db.sql("""
                    INSERT INTO dbo.rankings (user_id, course_id, total_score, total_duration_seconds, completed_quiz_count, last_achieved_at)
                    SELECT :uid, :cid, ISNULL(SUM(score), 0), ISNULL(SUM(duration_seconds), 0), COUNT(*), MAX(achieved_at)
                    FROM dbo.quiz_best_attempts WHERE user_id = :uid AND course_id = :cid""")
                    .param("uid", userId).param("cid", courseId).update();
        }
    }

    /** FR-RNK-01: Top 50, rút gọn tên với khách, ẩn danh nếu người học tắt hiển thị. */
    public PageResponse<RankingRow> leaderboard(long courseId, int page, int size, Long viewerId, boolean fullNames) {
        int limit = 50;
        long total = Math.min(limit, db.sql(ELIGIBLE + "SELECT COUNT(*) FROM ranked").param("cid", courseId)
                .query(Long.class).single());
        int offset = page * size;
        int take = (int) Math.max(0, Math.min(size, limit - offset));
        List<RankingRow> rows = take == 0 ? List.of() : db.sql(ELIGIBLE + """
                SELECT rank_no, user_id, full_name, avatar_url, show_on_leaderboard, total_score, total_duration_seconds, completed_quiz_count
                FROM ranked ORDER BY rank_no, user_id OFFSET :offset ROWS FETCH NEXT :take ROWS ONLY""")
                .param("cid", courseId).param("offset", offset).param("take", take)
                .query((rs, i) -> {
                    long uid = rs.getLong("user_id");
                    boolean me = viewerId != null && viewerId == uid;
                    boolean visible = rs.getBoolean("show_on_leaderboard") || me;
                    String name = !visible ? "Học viên ẩn danh"
                            : (fullNames || me) ? rs.getString("full_name") : shorten(rs.getString("full_name"));
                    return new RankingRow(rs.getInt("rank_no"), uid, name, visible ? rs.getString("avatar_url") : null,
                            rs.getBigDecimal("total_score"), rs.getInt("total_duration_seconds"),
                            rs.getInt("completed_quiz_count"), me);
                }).list();
        return PageResponse.of(rows, page, size, total);
    }

    public MyRank myRank(long courseId, long userId) {
        long totalRanked = db.sql(ELIGIBLE + "SELECT COUNT(*) FROM ranked").param("cid", courseId).query(Long.class).single();
        return db.sql(ELIGIBLE + "SELECT rank_no, total_score, total_duration_seconds, completed_quiz_count FROM ranked WHERE user_id = :uid")
                .param("cid", courseId).param("uid", userId)
                .query((rs, i) -> new MyRank(rs.getInt(1), totalRanked, rs.getBigDecimal(2), rs.getInt(3), rs.getInt(4)))
                .optional().orElse(new MyRank(null, totalRanked, null, null, null));
    }

    /** "Nguyễn Văn An" → "Nguyễn V. A." */
    static String shorten(String fullName) {
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) {
            return parts[0];
        }
        StringBuilder sb = new StringBuilder(parts[0]);
        for (int i = 1; i < parts.length; i++) {
            sb.append(' ').append(parts[i].charAt(0)).append('.');
        }
        return sb.toString();
    }

    /** FR-RNK-04 / design-db 05 §6.5: dựng lại lượt tốt nhất và bảng xếp hạng (sau khi đã chấm lại). */
    public void rebuild(long courseId) {
        db.sql("DELETE FROM dbo.quiz_best_attempts WHERE course_id = :cid").param("cid", courseId).update();
        db.sql("""
                WITH ranked AS (
                    SELECT a.id, a.user_id, a.quiz_id, a.score, a.duration_seconds, a.submitted_at,
                           ROW_NUMBER() OVER (PARTITION BY a.user_id, a.quiz_id
                                              ORDER BY a.score DESC, a.duration_seconds ASC, a.submitted_at ASC) AS rn
                    FROM dbo.quiz_attempts a
                    JOIN dbo.quizzes q ON q.id = a.quiz_id
                    JOIN dbo.lessons l ON l.id = q.lesson_id
                    WHERE l.course_id = :cid AND a.status IN (N'SUBMITTED', N'EXPIRED') AND a.counts_for_ranking = 1
                )
                INSERT INTO dbo.quiz_best_attempts (user_id, quiz_id, course_id, attempt_id, score, duration_seconds, achieved_at)
                SELECT user_id, quiz_id, :cid, id, score, duration_seconds, submitted_at FROM ranked WHERE rn = 1""")
                .param("cid", courseId).update();
        db.sql("DELETE FROM dbo.rankings WHERE course_id = :cid").param("cid", courseId).update();
        db.sql("""
                INSERT INTO dbo.rankings (user_id, course_id, total_score, total_duration_seconds, completed_quiz_count, last_achieved_at)
                SELECT user_id, :cid, SUM(score), SUM(duration_seconds), COUNT(*), MAX(achieved_at)
                FROM dbo.quiz_best_attempts WHERE course_id = :cid GROUP BY user_id""")
                .param("cid", courseId).update();
    }
}
