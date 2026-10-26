package vn.bdhvs.catalog;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class CatalogDtos {

    private CatalogDtos() {
    }

    public record CategoryNode(long id, String name, String slug, String description, String iconUrl,
            int courseCount, List<CategoryNode> children) {
    }

    public record OrganizationItem(long id, String name, String slug, String logoUrl, int courseCount) {
    }

    /** Lượt ghi danh của người đang đăng nhập, gắn vào thẻ/chi tiết khóa học. */
    public record MyEnrollment(long id, String status, int progressPercent, int completedLessonCount,
            Instant learningStartedAt, Instant expiresAt, Instant expiredAt, Instant completedAt, int roundNo,
            Long lastLessonId) {
    }

    public record CourseCard(long id, String slug, String title, String shortDescription, String thumbnailUrl,
            String level, String timeStatus, Instant startDate, Instant endDate, int publishedLessonCount,
            Integer estimatedMinutes, int enrollmentCount, BigDecimal ratingAvg, int ratingCount,
            int learningDurationDays, long organizationId, String organizationName, long categoryId,
            String categoryName, String categorySlug, long parentCategoryId, String parentCategoryName,
            MyEnrollment myEnrollment) {
    }

    public record FacetValue(String value, String label, long count) {
    }

    public record Facets(Map<String, List<FacetValue>> groups) {
    }

    public record CourseDetail(long id, String slug, String title, String shortDescription, String description,
            String outcomes, String targetAudience, String prerequisites, String thumbnailUrl, String level,
            String publishStatus, String timeStatus, Instant startDate, Instant endDate, int publishedLessonCount,
            Integer estimatedMinutes, int enrollmentCount, BigDecimal ratingAvg, int ratingCount,
            int learningDurationDays, String certificateCriteria, OrganizationRef organization,
            CategoryRef category, CategoryRef parentCategory, MyEnrollment myEnrollment, boolean canReview) {

        public CourseDetail withCanReview(boolean value) {
            return new CourseDetail(id, slug, title, shortDescription, description, outcomes, targetAudience,
                    prerequisites, thumbnailUrl, level, publishStatus, timeStatus, startDate, endDate,
                    publishedLessonCount, estimatedMinutes, enrollmentCount, ratingAvg, ratingCount,
                    learningDurationDays, certificateCriteria, organization, category, parentCategory, myEnrollment,
                    value);
        }
    }

    public record OrganizationRef(long id, String name, String slug, String logoUrl, String description,
            int courseCount) {
    }

    public record CategoryRef(long id, String name, String slug) {
    }

    /** Trạng thái bài với người học: COMPLETED / IN_PROGRESS / UNLOCKED / LOCKED; null nếu chưa ghi danh. */
    public record LessonItem(long id, int orderIndex, String title, Integer estimatedMinutes, boolean hasQuiz,
            String state, Integer bestScorePercent) {
    }

    public record HomeData(List<CourseCard> featured, List<CourseCard> newest, List<CategoryNode> categories,
            Map<String, Long> stats) {
    }

    // ---------- Đánh giá (FR-CRS-07) ----------

    public record ReviewItem(long id, long userId, String authorName, String authorAvatarUrl, int rating,
            String comment, Instant createdAt, Instant updatedAt) {
    }

    public record ReviewSummary(BigDecimal average, int count, Map<Integer, Integer> distribution) {
    }

    public record ReviewPage(ReviewSummary summary, List<ReviewItem> items, int page, int size, long totalItems,
            int totalPages, ReviewItem myReview, boolean canReview) {
    }

    public record ReviewRequest(@NotNull(message = "Vui lòng chọn số sao") @Min(1) @Max(5) Integer rating,
            @Size(max = 1000, message = "Nhận xét tối đa 1000 ký tự") String comment) {
    }

    // ---------- Xếp hạng (FR-RNK-01, 02) ----------

    public record RankingRow(int rank, long userId, String displayName, String avatarUrl, BigDecimal totalScore,
            int totalDurationSeconds, int completedQuizCount, boolean me) {
    }

    public record MyRank(Integer rank, long totalRanked, BigDecimal totalScore, Integer totalDurationSeconds,
            Integer completedQuizCount) {
    }
}
