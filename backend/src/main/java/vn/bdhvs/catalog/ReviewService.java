package vn.bdhvs.catalog;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.bdhvs.catalog.CatalogDtos.ReviewItem;
import vn.bdhvs.catalog.CatalogDtos.ReviewPage;
import vn.bdhvs.catalog.CatalogDtos.ReviewRequest;
import vn.bdhvs.catalog.CatalogDtos.ReviewSummary;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.util.Texts;

/** FR-CRS-07, BR-CRS-03, BR-CRS-05. */
@Service
public class ReviewService {

    private static final String ITEM_SELECT = """
            SELECT r.id, r.user_id, u.full_name AS author_name, u.avatar_url AS author_avatar_url, r.rating, r.comment,
                   r.created_at, r.updated_at
            FROM dbo.course_reviews r JOIN dbo.users u ON u.id = r.user_id
            """;

    private final JdbcClient db;
    private final CatalogService catalog;

    public ReviewService(JdbcClient db, CatalogService catalog) {
        this.db = db;
        this.catalog = catalog;
    }

    public ReviewPage list(long courseId, int page, int size, Long userId) {
        Map<Integer, Integer> dist = new LinkedHashMap<>();
        for (int s = 5; s >= 1; s--) {
            dist.put(s, 0);
        }
        db.sql("SELECT rating, COUNT(*) FROM dbo.course_reviews WHERE course_id = :c AND is_hidden = 0 GROUP BY rating")
                .param("c", courseId).query((rs, i) -> dist.put(rs.getInt(1), rs.getInt(2))).list();
        record Agg(BigDecimal ratingAvg, int ratingCount) {
        }
        Agg agg = db.sql("SELECT rating_avg, rating_count FROM dbo.courses WHERE id = :c").param("c", courseId)
                .query(Agg.class).single();
        List<ReviewItem> items = db.sql(ITEM_SELECT + """
                WHERE r.course_id = :c AND r.is_hidden = 0 AND u.deleted_at IS NULL
                ORDER BY r.created_at DESC, r.id DESC OFFSET :off ROWS FETCH NEXT :size ROWS ONLY""")
                .param("c", courseId).param("off", page * size).param("size", size).query(ReviewItem.class).list();
        long total = agg.ratingCount();
        ReviewItem mine = userId == null ? null
                : db.sql(ITEM_SELECT + " WHERE r.course_id = :c AND r.user_id = :u").param("c", courseId).param("u", userId)
                        .query(ReviewItem.class).optional().orElse(null);
        boolean can = userId != null && catalog.canReview(courseId, userId);
        return new ReviewPage(new ReviewSummary(agg.ratingAvg(), agg.ratingCount(), dist), items, page, size, total,
                (int) ((total + size - 1) / size), mine, can);
    }

    @Transactional
    public ReviewItem upsert(long courseId, long userId, ReviewRequest req, boolean createOnly) {
        if (!catalog.canReview(courseId, userId)) {
            throw ApiException.forbidden("REVIEW_NOT_ALLOWED", "Bạn cần hoàn thành ít nhất 1 bài học để viết đánh giá");
        }
        String comment = Texts.trimToNull(req.comment());
        int updated = db.sql("""
                UPDATE dbo.course_reviews SET rating = :r, comment = :cm, updated_at = SYSUTCDATETIME()
                WHERE course_id = :c AND user_id = :u""")
                .param("r", req.rating()).param("cm", comment).param("c", courseId).param("u", userId).update();
        if (updated > 0 && createOnly) {
            throw ApiException.conflict("REVIEW_EXISTS", "Bạn đã đánh giá khóa học này, hãy sửa đánh giá cũ");
        }
        if (updated == 0) {
            db.sql("INSERT INTO dbo.course_reviews (course_id, user_id, rating, comment) VALUES (:c, :u, :r, :cm)")
                    .param("c", courseId).param("u", userId).param("r", req.rating()).param("cm", comment).update();
        }
        refreshAggregate(courseId);
        return db.sql(ITEM_SELECT + " WHERE r.course_id = :c AND r.user_id = :u").param("c", courseId).param("u", userId)
                .query(ReviewItem.class).single();
    }

    @Transactional
    public void delete(long courseId, long userId) {
        int n = db.sql("DELETE FROM dbo.course_reviews WHERE course_id = :c AND user_id = :u")
                .param("c", courseId).param("u", userId).update();
        if (n == 0) {
            throw ApiException.notFound("Bạn chưa có đánh giá cho khóa học này");
        }
        refreshAggregate(courseId);
    }

    /** BR-CRS-05: đánh giá bị ẩn không tính vào điểm trung bình. */
    public void refreshAggregate(long courseId) {
        db.sql("""
                UPDATE c SET rating_avg = ISNULL(x.avg_rating, 0), rating_count = x.cnt, updated_at = SYSUTCDATETIME()
                FROM dbo.courses c
                CROSS APPLY (SELECT CAST(AVG(CAST(rating AS DECIMAL(5,2))) AS DECIMAL(3,2)) AS avg_rating, COUNT(*) AS cnt
                             FROM dbo.course_reviews WHERE course_id = c.id AND is_hidden = 0) x
                WHERE c.id = :c""").param("c", courseId).update();
    }
}
