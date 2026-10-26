package vn.bdhvs.admin;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAccessor;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import vn.bdhvs.admin.AdminCourseService.CourseForm;
import vn.bdhvs.admin.AdminCourseService.CourseRequest;
import vn.bdhvs.admin.AdminCourseService.CourseRow;
import vn.bdhvs.admin.AdminCourseService.EnrollmentRow;
import vn.bdhvs.admin.AdminInsightService.Actor;
import vn.bdhvs.admin.AdminInsightService.AuditRow;
import vn.bdhvs.admin.AdminInsightService.Dashboard;
import vn.bdhvs.admin.AdminInsightService.ReviewAdmin;
import vn.bdhvs.admin.AdminLessonService.ImportResult;
import vn.bdhvs.admin.AdminLessonService.LessonForm;
import vn.bdhvs.admin.AdminLessonService.LessonRequest;
import vn.bdhvs.admin.AdminLessonService.LessonRow;
import vn.bdhvs.admin.AdminLessonService.OrderItem;
import vn.bdhvs.admin.AdminLessonService.QuestionForm;
import vn.bdhvs.admin.AdminLessonService.QuestionRequest;
import vn.bdhvs.admin.AdminLessonService.QuizForm;
import vn.bdhvs.admin.AdminLessonService.QuizRequest;
import vn.bdhvs.admin.AdminTaxonomyService.CategoryAdmin;
import vn.bdhvs.admin.AdminTaxonomyService.CategoryRequest;
import vn.bdhvs.admin.AdminTaxonomyService.OrganizationAdmin;
import vn.bdhvs.admin.AdminTaxonomyService.OrganizationRequest;
import vn.bdhvs.admin.AdminTaxonomyService.SortItem;
import vn.bdhvs.admin.AdminUserService.CreateUser;
import vn.bdhvs.admin.AdminUserService.UpdateUser;
import vn.bdhvs.admin.AdminUserService.UserDetail;
import vn.bdhvs.admin.AdminUserService.UserRow;
import vn.bdhvs.catalog.CatalogDtos.RankingRow;
import vn.bdhvs.common.security.CurrentUser;
import vn.bdhvs.common.web.PageResponse;
import vn.bdhvs.files.FileStorageService;
import vn.bdhvs.ranking.RankingService;

/** SRS 08 §6 — /api/v1/admin (chỉ ADMIN, xem SecurityConfig). */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private static final DateTimeFormatter CSV_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final AdminUserService users;
    private final AdminTaxonomyService taxonomy;
    private final AdminCourseService courses;
    private final AdminLessonService lessons;
    private final AdminInsightService insight;
    private final RankingService ranking;
    private final FileStorageService files;

    public AdminController(AdminUserService users, AdminTaxonomyService taxonomy, AdminCourseService courses,
            AdminLessonService lessons, AdminInsightService insight, RankingService ranking, FileStorageService files) {
        this.users = users;
        this.taxonomy = taxonomy;
        this.courses = courses;
        this.lessons = lessons;
        this.insight = insight;
        this.ranking = ranking;
        this.files = files;
    }

    public record IdResponse(long id) {
    }

    public record ReasonRequest(String reason) {
    }

    private static long actor() {
        return CurrentUser.id();
    }

    private static ResponseEntity<IdResponse> created(long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(new IdResponse(id));
    }

    // ============================================================ dashboard

    @GetMapping("/dashboard")
    public Dashboard dashboard() {
        return insight.dashboard();
    }

    // ============================================================ người dùng

    @GetMapping("/users")
    public PageResponse<UserRow> users(@RequestParam(required = false) String q, @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdTo,
            @RequestParam(required = false) String sort, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        int[] p = PageResponse.clamp(page, size, 20, 50);
        return users.list(q, role, status, createdFrom, createdTo, sort, p[0], p[1]);
    }

    @GetMapping("/users/export")
    public ResponseEntity<byte[]> exportUsers(@RequestParam(required = false) String q,
            @RequestParam(required = false) String role, @RequestParam(required = false) String status) {
        List<UserRow> rows = users.list(q, role, status, null, null, null, 0, 100_000).items();
        return csv("nguoi-dung.csv", List.of("ID", "Họ tên", "Email", "Điện thoại", "Vai trò", "Trạng thái", "Ngày tạo", "Đăng nhập gần nhất"),
                rows, r -> Arrays.asList(r.id(), r.fullName(), r.email(), r.phone(), r.roles(), r.status(), time(r.createdAt()), time(r.lastLoginAt())));
    }

    @PostMapping("/users")
    public ResponseEntity<IdResponse> createUser(@Valid @RequestBody CreateUser body) {
        return created(users.create(body, actor()));
    }

    @GetMapping("/users/{id}")
    public UserDetail user(@PathVariable long id) {
        return users.detail(id);
    }

    @PutMapping("/users/{id}")
    public UserDetail updateUser(@PathVariable long id, @Valid @RequestBody UpdateUser body) {
        users.update(id, body, actor());
        return users.detail(id);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable long id) {
        users.delete(id, actor());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{id}/lock")
    public UserDetail lock(@PathVariable long id, @RequestBody ReasonRequest body) {
        users.lock(id, body.reason(), actor());
        return users.detail(id);
    }

    @PostMapping("/users/{id}/unlock")
    public UserDetail unlock(@PathVariable long id) {
        users.unlock(id, actor());
        return users.detail(id);
    }

    @PostMapping("/users/{id}/send-reset-password")
    public ResponseEntity<Void> sendReset(@PathVariable long id) {
        users.sendResetPassword(id, actor());
        return ResponseEntity.noContent().build();
    }

    // ============================================================ loại khóa học & tổ chức

    @GetMapping("/categories")
    public List<CategoryAdmin> categories() {
        return taxonomy.categories();
    }

    @PostMapping("/categories")
    public ResponseEntity<IdResponse> createCategory(@Valid @RequestBody CategoryRequest body) {
        return created(taxonomy.createCategory(body, actor()));
    }

    @PutMapping("/categories/reorder")
    public ResponseEntity<Void> reorderCategories(@Valid @RequestBody List<SortItem> body) {
        taxonomy.reorderCategories(body, actor());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<Void> updateCategory(@PathVariable long id, @Valid @RequestBody CategoryRequest body) {
        taxonomy.updateCategory(id, body, actor());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable long id) {
        taxonomy.deleteCategory(id, actor());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/organizations")
    public List<OrganizationAdmin> organizations(@RequestParam(required = false) String q) {
        return taxonomy.organizations(q);
    }

    @PostMapping("/organizations")
    public ResponseEntity<IdResponse> createOrganization(@Valid @RequestBody OrganizationRequest body) {
        return created(taxonomy.createOrganization(body, actor()));
    }

    @PutMapping("/organizations/{id}")
    public ResponseEntity<Void> updateOrganization(@PathVariable long id, @Valid @RequestBody OrganizationRequest body) {
        taxonomy.updateOrganization(id, body, actor());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/organizations/{id}")
    public ResponseEntity<Void> deleteOrganization(@PathVariable long id) {
        taxonomy.deleteOrganization(id, actor());
        return ResponseEntity.noContent().build();
    }

    // ============================================================ khóa học

    @GetMapping("/courses")
    public PageResponse<CourseRow> courses(@RequestParam(required = false) String q,
            @RequestParam(required = false) Long categoryId, @RequestParam(required = false) Long organizationId,
            @RequestParam(required = false) String level, @RequestParam(required = false) String publishStatus,
            @RequestParam(required = false) String timeStatus, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        int[] p = PageResponse.clamp(page, size, 20, 50);
        return courses.list(q, categoryId, organizationId, level, publishStatus, timeStatus, p[0], p[1]);
    }

    @PostMapping("/courses")
    public ResponseEntity<IdResponse> createCourse(@Valid @RequestBody CourseRequest body) {
        return created(courses.create(body, actor()));
    }

    @GetMapping("/courses/{id}")
    public CourseForm course(@PathVariable long id) {
        return courses.get(id);
    }

    @PutMapping("/courses/{id}")
    public CourseForm updateCourse(@PathVariable long id, @Valid @RequestBody CourseRequest body) {
        courses.update(id, body, actor());
        return courses.get(id);
    }

    @DeleteMapping("/courses/{id}")
    public ResponseEntity<Void> deleteCourse(@PathVariable long id) {
        courses.delete(id, actor());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/courses/{id}/publish")
    public CourseForm publish(@PathVariable long id) {
        courses.publish(id, actor());
        return courses.get(id);
    }

    @PostMapping("/courses/{id}/restore")
    public CourseForm restore(@PathVariable long id) {
        courses.publish(id, actor());
        return courses.get(id);
    }

    @PostMapping("/courses/{id}/unpublish")
    public CourseForm unpublish(@PathVariable long id) {
        courses.unpublish(id, actor());
        return courses.get(id);
    }

    @PostMapping("/courses/{id}/archive")
    public CourseForm archive(@PathVariable long id) {
        courses.archive(id, actor());
        return courses.get(id);
    }

    @GetMapping("/courses/{id}/enrollments")
    public PageResponse<EnrollmentRow> enrollments(@PathVariable long id, @RequestParam(required = false) String status,
            @RequestParam(required = false) String q, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        int[] p = PageResponse.clamp(page, size, 20, 100);
        return courses.enrollments(id, status, q, p[0], p[1]);
    }

    @GetMapping("/courses/{id}/enrollments/export")
    public ResponseEntity<byte[]> exportEnrollments(@PathVariable long id, @RequestParam(required = false) String status) {
        List<EnrollmentRow> rows = courses.enrollments(id, status, null, 0, 100_000).items();
        return csv("hoc-vien-khoa-" + id + ".csv",
                List.of("Họ tên", "Email", "Trạng thái", "Lần học", "Tiến độ %", "Ngày ghi danh", "Hạn học", "Hoàn thành", "Tổng điểm"),
                rows, r -> Arrays.asList(r.fullName(), r.email(), r.status(), r.roundNo(), r.progressPercent(), time(r.enrolledAt()),
                        time(r.expiresAt()), time(r.completedAt()), r.totalScore()));
    }

    @GetMapping("/courses/{id}/ranking")
    public PageResponse<RankingRow> ranking(@PathVariable long id, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        int[] p = PageResponse.clamp(page, size, 50, 50);
        return ranking.leaderboard(id, p[0], p[1], null, true);
    }

    @PostMapping("/courses/{id}/ranking/recalculate")
    public ResponseEntity<Map<String, String>> recalculate(@PathVariable long id) {
        courses.get(id);
        courses.recalculateRanking(id, actor());
        return ResponseEntity.accepted().body(Map.of("message", "Đang tính lại bảng xếp hạng. Việc này chạy nền trong vài phút"));
    }

    // ============================================================ bài học & quiz

    @GetMapping("/courses/{id}/lessons")
    public List<LessonRow> lessons(@PathVariable long id) {
        return lessons.lessons(id);
    }

    @PostMapping("/courses/{id}/lessons")
    public ResponseEntity<IdResponse> createLesson(@PathVariable long id, @Valid @RequestBody LessonRequest body) {
        return created(lessons.createLesson(id, body, actor()));
    }

    @PutMapping("/courses/{id}/lessons/reorder")
    public List<LessonRow> reorder(@PathVariable long id, @Valid @RequestBody List<OrderItem> body) {
        lessons.reorder(id, body, actor());
        return lessons.lessons(id);
    }

    @GetMapping("/lessons/{id}")
    public LessonForm lesson(@PathVariable long id) {
        return lessons.lesson(id);
    }

    @PutMapping("/lessons/{id}")
    public LessonForm updateLesson(@PathVariable long id, @Valid @RequestBody LessonRequest body) {
        lessons.updateLesson(id, body, actor());
        return lessons.lesson(id);
    }

    @DeleteMapping("/lessons/{id}")
    public ResponseEntity<Void> deleteLesson(@PathVariable long id) {
        lessons.deleteLesson(id, actor());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/lessons/{id}/quiz")
    public QuizForm upsertQuiz(@PathVariable long id, @Valid @RequestBody QuizRequest body) {
        return lessons.upsertQuiz(id, body, actor());
    }

    @DeleteMapping("/lessons/{id}/quiz")
    public ResponseEntity<Void> deleteQuiz(@PathVariable long id) {
        lessons.deleteQuiz(id, actor());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/quizzes/{id}/questions")
    public List<QuestionForm> questions(@PathVariable long id) {
        return lessons.questions(id);
    }

    @PostMapping("/quizzes/{id}/questions")
    public ResponseEntity<QuestionForm> createQuestion(@PathVariable long id, @Valid @RequestBody QuestionRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(lessons.createQuestion(id, body, actor()));
    }

    @PostMapping(value = "/quizzes/{id}/questions/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportResult importQuestions(@PathVariable long id, @RequestPart("file") MultipartFile file) throws java.io.IOException {
        return lessons.importCsv(id, new String(file.getBytes(), StandardCharsets.UTF_8), actor());
    }

    @PutMapping("/questions/{id}")
    public QuestionForm updateQuestion(@PathVariable long id, @Valid @RequestBody QuestionRequest body) {
        return lessons.updateQuestion(id, body, actor());
    }

    @DeleteMapping("/questions/{id}")
    public ResponseEntity<Void> deleteQuestion(@PathVariable long id) {
        lessons.deleteQuestion(id, actor());
        return ResponseEntity.noContent().build();
    }

    // ============================================================ đánh giá, nhật ký, tệp

    @GetMapping("/reviews")
    public PageResponse<ReviewAdmin> reviews(@RequestParam(required = false) Long courseId,
            @RequestParam(required = false) List<Integer> rating, @RequestParam(required = false) Boolean hidden,
            @RequestParam(required = false) String q, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        int[] p = PageResponse.clamp(page, size, 20, 50);
        return insight.reviews(courseId, rating, hidden, q, p[0], p[1]);
    }

    @GetMapping("/reviews/counts")
    public Map<String, Long> reviewCounts() {
        return insight.reviewCounts();
    }

    @PostMapping("/reviews/{id}/hide")
    public ResponseEntity<Void> hide(@PathVariable long id, @RequestBody ReasonRequest body) {
        insight.hideReview(id, body.reason(), actor());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reviews/{id}/show")
    public ResponseEntity<Void> show(@PathVariable long id, @RequestBody(required = false) ReasonRequest body) {
        insight.showReview(id, body == null ? null : body.reason(), actor());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/audit-logs")
    public PageResponse<AuditRow> auditLogs(@RequestParam(required = false) Long actorId,
            @RequestParam(required = false) String entityType, @RequestParam(required = false) String actionType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        int[] p = PageResponse.clamp(page, size, 20, 50);
        return insight.auditLogs(actorId, entityType, actionType, from, to, p[0], p[1]);
    }

    @GetMapping("/audit-logs/actors")
    public List<Actor> auditActors() {
        return insight.auditActors();
    }

    @PostMapping(value = "/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FileStorageService.Stored> upload(@RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "LESSON_ATTACHMENT") String purpose) {
        return ResponseEntity.status(HttpStatus.CREATED).body(files.store(file, purpose, actor()));
    }

    // ============================================================ CSV

    private static String time(TemporalAccessor t) {
        return t == null ? "" : CSV_TIME.format(t);
    }

    private static <T> ResponseEntity<byte[]> csv(String filename, List<String> header, List<T> rows,
            Function<T, List<?>> mapper) {
        StringBuilder sb = new StringBuilder("﻿");
        sb.append(String.join(",", header.stream().map(AdminController::cell).toList())).append("\r\n");
        for (T row : rows) {
            sb.append(String.join(",", mapper.apply(row).stream().map(v -> cell(v == null ? "" : v.toString())).toList()))
                    .append("\r\n");
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String cell(String v) {
        // Chống CSV injection khi mở bằng Excel.
        String s = v.matches("^[=+\\-@].*") ? "'" + v : v;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}
