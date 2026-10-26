package vn.bdhvs.catalog;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import vn.bdhvs.catalog.CatalogDtos.CategoryNode;
import vn.bdhvs.catalog.CatalogDtos.CourseCard;
import vn.bdhvs.catalog.CatalogDtos.CourseDetail;
import vn.bdhvs.catalog.CatalogDtos.Facets;
import vn.bdhvs.catalog.CatalogDtos.HomeData;
import vn.bdhvs.catalog.CatalogDtos.LessonItem;
import vn.bdhvs.catalog.CatalogDtos.MyRank;
import vn.bdhvs.catalog.CatalogDtos.OrganizationItem;
import vn.bdhvs.catalog.CatalogDtos.RankingRow;
import vn.bdhvs.catalog.CatalogDtos.ReviewItem;
import vn.bdhvs.catalog.CatalogDtos.ReviewPage;
import vn.bdhvs.catalog.CatalogDtos.ReviewRequest;
import vn.bdhvs.catalog.CatalogService.CourseFilter;
import vn.bdhvs.common.security.AuthUser;
import vn.bdhvs.common.security.CurrentUser;
import vn.bdhvs.common.web.PageResponse;
import vn.bdhvs.learning.EnrollmentService;
import vn.bdhvs.learning.EnrollmentService.EnrollResult;
import vn.bdhvs.ranking.RankingService;

/** SRS 08 §4 — khám phá khóa học (công khai) và ghi danh. */
@RestController
@RequestMapping("/api/v1")
public class CourseController {

    private final CatalogService catalog;
    private final ReviewService reviews;
    private final EnrollmentService enrollments;
    private final RankingService ranking;

    public CourseController(CatalogService catalog, ReviewService reviews, EnrollmentService enrollments,
            RankingService ranking) {
        this.catalog = catalog;
        this.reviews = reviews;
        this.enrollments = enrollments;
        this.ranking = ranking;
    }

    @GetMapping("/categories")
    public List<CategoryNode> categories() {
        return catalog.categories();
    }

    @GetMapping("/organizations")
    public List<OrganizationItem> organizations() {
        return catalog.organizations();
    }

    @GetMapping("/home")
    public HomeData home() {
        return catalog.home(CurrentUser.find().map(AuthUser::id).orElse(null));
    }

    @GetMapping("/courses")
    public PageResponse<CourseCard> search(@RequestParam(required = false) String q,
            @RequestParam(required = false) List<String> status, @RequestParam(required = false) List<String> myStatus,
            @RequestParam(required = false) List<String> category, @RequestParam(required = false) List<String> level,
            @RequestParam(required = false) List<Long> organization, @RequestParam(required = false) String sort,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        int[] p = PageResponse.clamp(page, size, 12, 50);
        return catalog.search(filter(q, status, myStatus, category, level, organization, sort), p[0], p[1]);
    }

    @GetMapping("/courses/facets")
    public Facets facets(@RequestParam(required = false) String q, @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) List<String> myStatus, @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) List<String> level, @RequestParam(required = false) List<Long> organization) {
        return catalog.facets(filter(q, status, myStatus, category, level, organization, null));
    }

    private static CourseFilter filter(String q, List<String> status, List<String> myStatus, List<String> category,
            List<String> level, List<Long> organization, String sort) {
        return new CourseFilter(q, status, myStatus, category, level, organization, sort,
                CurrentUser.find().map(AuthUser::id).orElse(null));
    }

    @GetMapping("/courses/{slug}")
    public CourseDetail detail(@PathVariable String slug) {
        return catalog.detail(slug, CurrentUser.find().orElse(null));
    }

    @GetMapping("/courses/{slug}/lessons")
    public List<LessonItem> lessons(@PathVariable String slug) {
        return catalog.lessons(slug, CurrentUser.find().orElse(null));
    }

    // ---------------- ghi danh

    @PostMapping("/courses/{slug}/enroll")
    public ResponseEntity<EnrollResult> enroll(@PathVariable String slug) {
        AuthUser u = CurrentUser.require();
        long courseId = catalog.visibleCourse(slug, u).id();
        return ResponseEntity.status(HttpStatus.CREATED).body(enrollments.enroll(courseId, u.id()));
    }

    @DeleteMapping("/courses/{slug}/enroll")
    public ResponseEntity<Void> cancel(@PathVariable String slug) {
        AuthUser u = CurrentUser.require();
        enrollments.cancel(catalog.visibleCourse(slug, u).id(), u.id());
        return ResponseEntity.noContent().build();
    }

    // ---------------- đánh giá

    @GetMapping("/courses/{slug}/reviews")
    public ReviewPage reviews(@PathVariable String slug, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        AuthUser u = CurrentUser.find().orElse(null);
        int[] p = PageResponse.clamp(page, size, 10, 50);
        return reviews.list(catalog.visibleCourse(slug, u).id(), p[0], p[1], u == null ? null : u.id());
    }

    @PostMapping("/courses/{slug}/reviews")
    public ResponseEntity<ReviewItem> createReview(@PathVariable String slug, @Valid @RequestBody ReviewRequest body) {
        AuthUser u = CurrentUser.require();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reviews.upsert(catalog.visibleCourse(slug, u).id(), u.id(), body, true));
    }

    @PutMapping("/courses/{slug}/reviews/me")
    public ReviewItem updateReview(@PathVariable String slug, @Valid @RequestBody ReviewRequest body) {
        AuthUser u = CurrentUser.require();
        return reviews.upsert(catalog.visibleCourse(slug, u).id(), u.id(), body, false);
    }

    @DeleteMapping("/courses/{slug}/reviews/me")
    public ResponseEntity<Void> deleteReview(@PathVariable String slug) {
        AuthUser u = CurrentUser.require();
        reviews.delete(catalog.visibleCourse(slug, u).id(), u.id());
        return ResponseEntity.noContent().build();
    }

    // ---------------- xếp hạng

    @GetMapping("/courses/{slug}/ranking")
    public PageResponse<RankingRow> ranking(@PathVariable String slug, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        AuthUser u = CurrentUser.find().orElse(null);
        int[] p = PageResponse.clamp(page, size, 20, 50);
        return ranking.leaderboard(catalog.visibleCourse(slug, u).id(), p[0], p[1], u == null ? null : u.id(), u != null);
    }

    @GetMapping("/courses/{slug}/ranking/me")
    public MyRank myRank(@PathVariable String slug) {
        AuthUser u = CurrentUser.require();
        return ranking.myRank(catalog.visibleCourse(slug, u).id(), u.id());
    }
}
