package vn.bdhvs.admin;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import vn.bdhvs.admin.AdminCourseService.CourseRequest;
import vn.bdhvs.admin.AdminLessonService.LessonRequest;
import vn.bdhvs.admin.AdminLessonService.OptionInput;
import vn.bdhvs.admin.AdminLessonService.QuestionRequest;
import vn.bdhvs.admin.AdminLessonService.QuizRequest;
import vn.bdhvs.admin.AdminTaxonomyService.CategoryRequest;
import vn.bdhvs.admin.AdminTaxonomyService.OrganizationRequest;
import vn.bdhvs.files.FileStorageService;
import vn.bdhvs.learning.EnrollmentService;
import vn.bdhvs.learning.LearningDtos.AnswerInput;
import vn.bdhvs.learning.QuizService;
import vn.bdhvs.ranking.RankingService;

/**
 * Dữ liệu mẫu cho dev/staging (design-db 04 §4). Chỉ chạy khi app.seed-demo-data=true và CSDL chưa có khóa học nào.
 * Mọi dữ liệu đều là dữ liệu giả lập để demo giao diện.
 */
@Component
@Order(2)
@ConditionalOnProperty(name = "app.seed-demo-data", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    public static final String DEMO_PASSWORD = "hocvien2026";

    private final JdbcClient db;
    private final AdminTaxonomyService taxonomy;
    private final AdminCourseService courses;
    private final AdminLessonService lessons;
    private final EnrollmentService enrollments;
    private final QuizService quizzes;
    private final RankingService ranking;
    private final PasswordEncoder encoder;
    private final FileStorageService files;

    public DemoDataSeeder(JdbcClient db, AdminTaxonomyService taxonomy, AdminCourseService courses,
            AdminLessonService lessons, EnrollmentService enrollments, QuizService quizzes, RankingService ranking,
            PasswordEncoder encoder, FileStorageService files) {
        this.db = db;
        this.taxonomy = taxonomy;
        this.courses = courses;
        this.lessons = lessons;
        this.enrollments = enrollments;
        this.quizzes = quizzes;
        this.ranking = ranking;
        this.encoder = encoder;
        this.files = files;
    }

    private record Q(String type, String content, String explanation, List<String> options) {
    }

    private record L(String title, int minutes, String content, String assignment, List<Q> quiz) {
    }

    private record C(String title, String category, String org, String level, String shortDescription,
            String[] colors, boolean featured, int startOffsetDays, Integer durationDays, List<L> lessons) {
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (db.sql("SELECT COUNT(*) FROM dbo.courses").query(Integer.class).single() > 0) {
            return;
        }
        long admin = db.sql("""
                SELECT TOP (1) u.id FROM dbo.users u JOIN dbo.user_roles ur ON ur.user_id = u.id JOIN dbo.roles r ON r.id = ur.role_id
                WHERE r.code = N'ADMIN' ORDER BY u.id""").query(Long.class).single();
        log.info("Đang tạo dữ liệu mẫu cho môi trường dev...");

        long kns = cat(null, "Kỹ năng số", "Máy tính, Internet, an toàn thông tin, dịch vụ công", admin);
        long nn = cat(null, "Ngoại ngữ", "Tiếng Anh giao tiếp và cho công việc", admin);
        long sp = cat(null, "Sư phạm & giáo dục", "Bài giảng điện tử, ứng dụng AI trong dạy học", admin);
        long kn = cat(null, "Kỹ năng mềm", "Học tập suốt đời, giao tiếp, làm việc nhóm", admin);
        Map<String, Long> cats = Map.of(
                "may-tinh", cat(kns, "Sử dụng máy tính cơ bản", null, admin),
                "attt", cat(kns, "An toàn thông tin", null, admin),
                "dvc", cat(kns, "Dịch vụ công trực tuyến", null, admin),
                "ta-gt", cat(nn, "Tiếng Anh giao tiếp", null, admin),
                "ta-cv", cat(nn, "Tiếng Anh cho công việc", null, admin),
                "elearning", cat(sp, "Bài giảng điện tử", null, admin),
                "ai", cat(sp, "AI trong dạy học", null, admin),
                "hoc-tap", cat(kn, "Học tập suốt đời", null, admin));
        Map<String, Long> orgs = Map.of(
                "tin-hoc", org("Trung tâm Tin học (dữ liệu mẫu)", admin),
                "cntt", org("Khoa Công nghệ thông tin (dữ liệu mẫu)", admin),
                "ngoai-ngu", org("Khoa Ngoại ngữ (dữ liệu mẫu)", admin),
                "su-pham", org("Khoa Sư phạm (dữ liệu mẫu)", admin),
                "dao-tao", org("Phòng Đào tạo (dữ liệu mẫu)", admin));

        List<Long> courseIds = new ArrayList<>();
        for (C c : catalog()) {
            courseIds.add(course(c, cats.get(c.category()), orgs.get(c.org()), admin));
        }

        List<Long> learners = new ArrayList<>();
        String[][] people = {
                {"Nguyễn Văn An", "an.nguyen@example.com"}, {"Trần Thị Bình", "binh.tran@example.com"},
                {"Lê Văn Cường", "cuong.le@example.com"}, {"Phạm Thu Hà", "ha.pham@example.com"},
                {"Đỗ Minh Khang", "khang.do@example.com"}, {"Vũ Thị Lan", "lan.vu@example.com"}};
        for (String[] p : people) {
            learners.add(learner(p[0], p[1]));
        }
        simulate(courseIds.get(1), learners, new int[] {2, 6, 6, 6, 5, 4}, new int[] {340, 250, 300, 280, 330, 360});
        simulate(courseIds.get(0), learners.subList(0, 4), new int[] {8, 3, 8, 2}, new int[] {400, 300, 380, 280});
        simulate(courseIds.get(3), learners.subList(0, 3), new int[] {7, 2, 4}, new int[] {500, 300, 420});
        // Một lượt đã quá hạn để thấy luồng "Hết hạn → Đăng ký học lại" (job sẽ xóa dữ liệu trong vòng 5 phút).
        enrollments.enroll(courseIds.get(5), learners.get(0));
        db.sql("""
                UPDATE dbo.enrollments SET enrolled_at = DATEADD(DAY, -23, SYSUTCDATETIME()),
                    learning_started_at = DATEADD(DAY, -23, SYSUTCDATETIME()), expires_at = DATEADD(DAY, -2, SYSUTCDATETIME())
                WHERE user_id = :u AND course_id = :c""").param("u", learners.get(0)).param("c", courseIds.get(5)).update();
        // Một lượt sắp hết hạn để thấy cảnh báo ≤ 3 ngày.
        db.sql("""
                UPDATE dbo.enrollments SET expires_at = DATEADD(HOUR, 54, SYSUTCDATETIME()),
                    learning_started_at = DATEADD(HOUR, 54 - 21 * 24, SYSUTCDATETIME())
                WHERE user_id = :u AND course_id = :c""").param("u", learners.get(0)).param("c", courseIds.get(1)).update();
        enrollments.expireOverdue();
        reviews(courseIds, learners);
        log.info("Đã tạo {} khóa học mẫu và {} học viên mẫu (mật khẩu: {})", courseIds.size(), learners.size(), DEMO_PASSWORD);
    }

    private long cat(Long parent, String name, String desc, long admin) {
        return taxonomy.createCategory(new CategoryRequest(parent, name, null, desc, null, null, true), admin);
    }

    private long org(String name, long admin) {
        return taxonomy.createOrganization(new OrganizationRequest(name, null, null, null, null,
                "Đơn vị mẫu cho môi trường phát triển", true), admin);
    }

    private long course(C c, long categoryId, long orgId, long admin) throws IOException {
        Instant start = c.startOffsetDays() > 0 ? Instant.now().plus(c.startOffsetDays(), ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS)
                : Instant.now().minus(60, ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS);
        Instant end = c.startOffsetDays() < 0 ? Instant.now().minus(3, ChronoUnit.DAYS) : start.plus(180, ChronoUnit.DAYS);
        if (c.startOffsetDays() < 0) {
            start = Instant.now().minus(200, ChronoUnit.DAYS);
        }
        String desc = "<p>" + c.shortDescription() + "</p><p>Khóa học gồm " + c.lessons().size()
                + " bài ngắn, mỗi bài có phần đọc, đề bài thực hành và bài quiz để kiểm tra lại kiến thức.</p>";
        long id = courses.create(new CourseRequest(c.title(), null, categoryId, orgId, c.level(), c.shortDescription(), desc,
                "<ul><li>Nắm được kiến thức cốt lõi của chủ đề</li><li>Tự thực hành được trên điện thoại hoặc máy tính</li><li>Biết cách xử lý các tình huống thường gặp</li></ul>",
                "<p>Mọi người dân, đặc biệt là người mới làm quen với công nghệ.</p>",
                "<p>Biết sử dụng điện thoại thông minh hoặc máy tính ở mức cơ bản.</p>",
                thumbnail(c), start, end, c.durationDays(), null, c.featured(), null), admin);
        for (L l : c.lessons()) {
            long lessonId = lessons.createLesson(id, new LessonRequest(l.title(), l.content(), null, l.assignment(), l.minutes(), true, null), admin);
            if (!l.quiz().isEmpty()) {
                long quizId = lessons.upsertQuiz(lessonId, new QuizRequest(null, 70, l.quiz().size() >= 4 ? 10 : null, null, 0,
                        false, false, true), admin).id();
                for (Q q : l.quiz()) {
                    List<OptionInput> opts = q.options().stream()
                            .map(o -> new OptionInput(null, o.startsWith("*") ? o.substring(1) : o, o.startsWith("*"))).toList();
                    lessons.createQuestion(quizId, new QuestionRequest(q.content(), q.type(), BigDecimal.ONE, q.explanation(), null, opts), admin);
                }
            }
        }
        courses.publish(id, admin);
        return id;
    }

    /** Ảnh bìa mẫu dạng SVG (do hệ thống tạo, không phải tệp người dùng tải lên). */
    private String thumbnail(C c) throws IOException {
        String slug = vn.bdhvs.common.util.Texts.slugify(c.title());
        Path dir = files.root().resolve("seed");
        Files.createDirectories(dir);
        String title = c.title().replace("&", "&amp;");
        String svg = """
                <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
                  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>
                  <rect width="640" height="360" fill="url(#g)"/>
                  <circle cx="560" cy="300" r="150" fill="#ffffff" fill-opacity="0.08"/>
                  <circle cx="600" cy="40" r="90" fill="#ffffff" fill-opacity="0.06"/>
                  <text x="36" y="300" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">%s</text>
                </svg>""".formatted(c.colors()[0], c.colors()[1], title.length() > 34 ? title.substring(0, 33) + "…" : title);
        Files.writeString(dir.resolve(slug + ".svg"), svg, StandardCharsets.UTF_8);
        return "/files/seed/" + slug + ".svg";
    }

    private long learner(String name, String email) {
        long id = db.sql("""
                INSERT INTO dbo.users (email, password_hash, full_name, status, email_verified_at, privacy_consent_at, created_at)
                OUTPUT INSERTED.id VALUES (:e, :pw, :n, N'ACTIVE', SYSUTCDATETIME(), SYSUTCDATETIME(),
                    DATEADD(DAY, -ABS(CHECKSUM(NEWID())) % 25, SYSUTCDATETIME()))""")
                .param("e", email).param("pw", encoder.encode(DEMO_PASSWORD)).param("n", name).query(Long.class).single();
        db.sql("INSERT INTO dbo.user_roles (user_id, role_id) SELECT :u, id FROM dbo.roles WHERE code = N'USER'").param("u", id).update();
        return id;
    }

    /** Người học làm quiz của {@code lessonsDone[i]} bài đầu, trả lời đúng, với thời gian làm bài khác nhau. */
    private void simulate(long courseId, List<Long> users, int[] lessonsDone, int[] seconds) {
        List<Long> quizIds = db.sql("""
                SELECT q.id FROM dbo.lessons l JOIN dbo.quizzes q ON q.lesson_id = l.id
                WHERE l.course_id = :c ORDER BY l.order_index""").param("c", courseId).query(Long.class).list();
        for (int i = 0; i < users.size(); i++) {
            long u = users.get(i);
            enrollments.enroll(courseId, u);
            int n = Math.min(lessonsDone[i], quizIds.size());
            for (int k = 0; k < n; k++) {
                long quizId = quizIds.get(k);
                long attempt = quizzes.start(quizId, u);
                List<AnswerInput> answers = db.sql("""
                        SELECT q.id, o.id FROM dbo.questions q JOIN dbo.question_options o ON o.question_id = q.id
                        WHERE q.quiz_id = :q AND o.is_correct = 1 AND o.is_active = 1""").param("q", quizId)
                        .query((rs, r) -> new AnswerInput(rs.getLong(1), List.of(rs.getLong(2)))).list();
                // Người thứ 4 trả lời sai 1 câu ở quiz có từ 4 câu (vẫn đạt 75%) để bảng xếp hạng có chênh lệch điểm.
                long questionCount = answers.stream().map(AnswerInput::questionId).distinct().count();
                List<AnswerInput> submit = (i == 3 && questionCount >= 4) ? answers.subList(1, answers.size()) : answers;
                db.sql("UPDATE dbo.quiz_attempts SET started_at = DATEADD(SECOND, -:s, SYSUTCDATETIME()) WHERE id = :id")
                        .param("s", seconds[i] / Math.max(1, n) + k * 7).param("id", attempt).update();
                quizzes.submit(attempt, u, merge(answers, submit));
            }
        }
        ranking.rebuild(courseId);
    }

    /** Gộp đáp án nhiều lựa chọn của cùng một câu. */
    private static List<AnswerInput> merge(List<AnswerInput> all, List<AnswerInput> chosen) {
        Map<Long, List<Long>> m = new java.util.LinkedHashMap<>();
        for (AnswerInput a : chosen) {
            m.computeIfAbsent(a.questionId(), k -> new ArrayList<>()).addAll(a.selectedOptionIds());
        }
        return m.entrySet().stream().map(e -> new AnswerInput(e.getKey(), e.getValue())).toList();
    }

    private void reviews(List<Long> courseIds, List<Long> learners) {
        String[][] texts = {
                {"5", "Nhờ khóa học mà mẹ tôi đã nhận ra cuộc gọi giả danh công an và không chuyển tiền. Rất thiết thực!"},
                {"5", "Quiz có giải thích từng câu nên học rất nhớ. Thời hạn 3 tuần là vừa đủ."},
                {"4", "Nội dung tốt, nhưng chữ trong video hơi nhỏ khi xem trên điện thoại."},
                {"5", "Bài giảng dễ hiểu, ví dụ sát thực tế."}};
        long course = courseIds.get(1);
        for (int i = 0; i < 4; i++) {
            db.sql("INSERT INTO dbo.course_reviews (course_id, user_id, rating, comment, created_at) VALUES (:c, :u, :r, :t, DATEADD(DAY, -:d, SYSUTCDATETIME()))")
                    .param("c", course).param("u", learners.get(i + 1)).param("r", Integer.parseInt(texts[i][0]))
                    .param("t", texts[i][1]).param("d", i + 1).update();
        }
        db.sql("""
                UPDATE c SET rating_avg = x.a, rating_count = x.n FROM dbo.courses c
                CROSS APPLY (SELECT CAST(AVG(CAST(rating AS DECIMAL(5,2))) AS DECIMAL(3,2)) AS a, COUNT(*) AS n
                             FROM dbo.course_reviews WHERE course_id = c.id AND is_hidden = 0) x
                WHERE x.n > 0""").update();
    }

    // ------------------------------------------------------------- nội dung mẫu

    private static Q single(String content, String explanation, String... options) {
        return new Q("SINGLE_CHOICE", content, explanation, List.of(options));
    }

    private static Q multi(String content, String explanation, String... options) {
        return new Q("MULTIPLE_CHOICE", content, explanation, List.of(options));
    }

    private static Q tf(String content, boolean correct, String explanation) {
        return new Q("TRUE_FALSE", content, explanation, correct ? List.of("*Đúng", "Sai") : List.of("Đúng", "*Sai"));
    }

    private static String p(String... paragraphs) {
        StringBuilder sb = new StringBuilder();
        for (String s : paragraphs) {
            sb.append(s.startsWith("<") ? s : "<p>" + s + "</p>");
        }
        return sb.toString();
    }

    private static List<C> catalog() {
        String[] red = {"#962521", "#c0392b"};
        String[] deep = {"#5e1210", "#962521"};
        String[] gold = {"#7a5900", "#c99a1e"};
        String[] rose = {"#b4505a", "#e2828a"};
        String[] ink = {"#3a2f2e", "#6b5a58"};
        String[] amber = {"#a8452b", "#d9774e"};
        List<C> list = new ArrayList<>();
        list.add(new C("Kỹ năng sử dụng máy tính và Internet cơ bản", "may-tinh", "tin-hoc", "BASIC",
                "Làm quen máy tính, chuột, bàn phím, thư mục, trình duyệt web và thư điện tử.", red, true, 0, null, List.of(
                        new L("Làm quen với máy tính", 30, p("Máy tính gồm màn hình, bàn phím, chuột và thân máy. Hãy bật máy bằng nút nguồn và chờ màn hình khởi động xong.",
                                "<h3>Chuột và bàn phím</h3>", "Nhấp chuột trái để chọn, nhấp đúp để mở, nhấp chuột phải để xem thêm lựa chọn."),
                                p("Bật máy tính, mở và đóng ứng dụng Notepad 3 lần."), List.of(
                                        single("Muốn mở một thư mục, bạn thường làm gì?", "Nhấp đúp chuột trái để mở.", "Nhấp chuột phải", "*Nhấp đúp chuột trái", "Nhấn phím Esc"),
                                        tf("Nên tắt máy tính bằng cách rút điện ngay.", false, "Hãy tắt máy qua menu Start > Shut down để tránh mất dữ liệu."),
                                        single("Phím nào dùng để xuống dòng khi soạn thảo?", null, "*Enter", "Shift", "Tab"))),
                        new L("Tệp tin và thư mục", 35, p("Tệp tin là nơi lưu dữ liệu như văn bản, ảnh. Thư mục giúp sắp xếp các tệp theo nhóm.",
                                "Hãy đặt tên thư mục rõ ràng, ví dụ: \"Giay to ca nhan\"."), p("Tạo thư mục \"Tai lieu hoc tap\" trên Desktop và lưu một tệp văn bản vào đó."), List.of(
                                        single("Thư mục dùng để làm gì?", null, "*Sắp xếp, nhóm các tệp", "Tăng tốc máy tính", "Diệt virus"),
                                        tf("Có thể đổi tên thư mục bằng cách nhấp chuột phải chọn Rename.", true, null),
                                        single("Tổ hợp phím sao chép là?", null, "*Ctrl + C", "Ctrl + V", "Ctrl + Z"))),
                        new L("Duyệt web an toàn", 40, p("Trình duyệt web (Chrome, Cốc Cốc, Edge) giúp bạn truy cập các trang web.",
                                "Hãy kiểm tra biểu tượng ổ khóa và tên miền trước khi nhập thông tin."), p("Mở trang web của một cơ quan nhà nước và tìm số điện thoại liên hệ."), List.of(
                                        single("Biểu tượng ổ khóa trên thanh địa chỉ cho biết điều gì?", "Kết nối được mã hóa HTTPS, nhưng vẫn cần kiểm tra đúng tên miền.",
                                                "*Kết nối đã được mã hóa", "Trang web chắc chắn là thật", "Trang web miễn phí"),
                                        tf("Nên tải phần mềm từ bất kỳ trang web nào có nút \"Tải xuống\".", false, "Chỉ tải từ nguồn chính thức."),
                                        single("Phím tắt mở tab mới trên trình duyệt?", null, "*Ctrl + T", "Ctrl + N", "Ctrl + P"))),
                        new L("Thư điện tử (email)", 35, p("Email giúp gửi thư và tệp đính kèm. Địa chỉ email có dạng ten@tenmien."),
                                p("Gửi một email có đính kèm ảnh cho chính bạn."), List.of(
                                        single("Địa chỉ email nào đúng định dạng?", null, "*nguyenvanan@gmail.com", "nguyenvanan.gmail.com", "nguyen van an@gmail"),
                                        tf("Không nên mở tệp đính kèm từ người lạ.", true, null),
                                        single("Mục \"CC\" trong email dùng để?", null, "*Gửi bản sao cho người khác", "Chặn người gửi", "Xóa thư"))),
                        new L("Tổng kết khóa học", 20, p("Ôn lại các kỹ năng: dùng chuột, bàn phím, quản lý tệp, duyệt web và email."), null, List.of(
                                single("Kỹ năng nào giúp bạn tìm lại tài liệu nhanh nhất?", null, "*Đặt tên và sắp xếp thư mục hợp lý", "Lưu mọi thứ ngoài Desktop", "Đổi hình nền"),
                                tf("Nên đặt mật khẩu cho tài khoản máy tính.", true, null),
                                single("Khi nghi ngờ một email lừa đảo, bạn nên?", null, "*Không bấm link, xóa thư", "Trả lời hỏi lại", "Chuyển tiếp cho bạn bè"))))));
        list.add(new C("An toàn thông tin và phòng tránh lừa đảo trực tuyến", "attt", "cntt", "BASIC",
                "Nhận diện các thủ đoạn lừa đảo phổ biến, bảo vệ tài khoản và dữ liệu cá nhân khi dùng Internet, mạng xã hội và ngân hàng số.",
                deep, true, 0, null, List.of(
                        new L("Vì sao cần an toàn thông tin?", 35, p("Thông tin cá nhân như số CCCD, số tài khoản, mã OTP có thể bị kẻ gian lợi dụng để chiếm đoạt tài sản."),
                                p("Liệt kê 5 loại thông tin cá nhân bạn đang lưu trên điện thoại."), List.of(
                                        tf("Mã OTP chỉ nên được nhập trên ứng dụng/trang web chính thức do chính bạn mở.", true, null),
                                        single("Thông tin nào KHÔNG nên công khai trên mạng xã hội?", null, "*Ảnh chụp CCCD", "Sở thích", "Bài hát yêu thích"),
                                        single("Ai được phép biết mã OTP của bạn?", "Không ai, kể cả nhân viên ngân hàng.", "*Không ai cả", "Nhân viên ngân hàng", "Người thân"))),
                        new L("Tạo và quản lý mật khẩu an toàn", 45, p("Mật khẩu mạnh dài tối thiểu 12 ký tự, kết hợp chữ, số và ký tự đặc biệt.",
                                "Bật xác thực 2 lớp cho email, mạng xã hội và ngân hàng."), p("Đổi mật khẩu email của bạn và bật xác thực 2 lớp."), List.of(
                                        single("Mật khẩu nào mạnh nhất?", null, "*Hoa-Sen-No#2026!", "12345678", "ngaysinh1968"),
                                        tf("Dùng chung một mật khẩu cho mọi tài khoản là an toàn.", false, "Lộ một tài khoản sẽ lộ tất cả."),
                                        single("Xác thực 2 lớp nghĩa là?", null, "*Cần thêm mã xác nhận ngoài mật khẩu", "Đặt 2 mật khẩu giống nhau", "Đăng nhập 2 lần"))),
                        new L("Nhận diện tin nhắn, cuộc gọi lừa đảo", 50, p("Kẻ gian thường giả danh ngân hàng, cơ quan nhà nước hoặc người quen để yêu cầu bạn bấm vào đường link, cung cấp mã OTP hoặc chuyển tiền gấp.",
                                "<ul><li>Thúc giục, đe dọa: \"tài khoản sẽ bị khóa trong 24 giờ\".</li><li>Đường link lạ, sai chính tả tên miền, rút gọn link.</li><li>Yêu cầu cung cấp mã OTP, mật khẩu, số thẻ.</li></ul>"),
                                p("Tìm 2 tin nhắn rác trong điện thoại của bạn và chỉ ra dấu hiệu lừa đảo."), List.of(
                                        multi("Những dấu hiệu nào cho thấy một tin nhắn có thể là lừa đảo?", "Việc thúc giục \"phải làm ngay\" là thủ đoạn tâm lý phổ biến để bạn không kịp suy nghĩ.",
                                                "*Yêu cầu bạn cung cấp mã OTP để \"xác minh tài khoản\"", "Gửi từ tổng đài chính thức, không kèm đường link",
                                                "*Đường link có tên miền lạ, ví dụ nganhang-xacminh.top", "*Thúc giục phải làm ngay nếu không tài khoản sẽ bị khóa"),
                                        tf("Ngân hàng có thể gọi điện yêu cầu bạn đọc mã OTP.", false, "Ngân hàng không bao giờ yêu cầu bạn đọc OTP."),
                                        single("Nhận cuộc gọi tự xưng công an yêu cầu chuyển tiền, bạn nên?", null, "*Cúp máy, gọi lại số chính thức để xác minh", "Chuyển tiền ngay", "Đọc số tài khoản"),
                                        single("Link rút gọn lạ trong tin nhắn nên được xử lý thế nào?", null, "*Không bấm vào", "Bấm thử xem", "Gửi cho bạn bè"))),
                        new L("Bảo vệ tài khoản mạng xã hội", 40, p("Kiểm tra cài đặt quyền riêng tư, giới hạn người xem bài viết, cảnh giác với tin nhắn mượn tiền từ tài khoản người quen."),
                                p("Kiểm tra lại cài đặt quyền riêng tư trên Facebook/Zalo."), List.of(
                                        single("Người quen nhắn mượn tiền gấp qua mạng xã hội, bạn nên?", null, "*Gọi điện trực tiếp xác minh", "Chuyển ngay", "Gửi mã OTP"),
                                        tf("Nên chấp nhận mọi lời mời kết bạn để có nhiều bạn bè.", false, null),
                                        single("Khi bị chiếm tài khoản, việc đầu tiên nên làm?", null, "*Khôi phục mật khẩu và báo bạn bè", "Tạo tài khoản mới", "Im lặng"))),
                        new L("Giao dịch ngân hàng số an toàn", 45, p("Chỉ dùng ứng dụng ngân hàng tải từ kho ứng dụng chính thức. Không cài ứng dụng từ đường link lạ."),
                                p("Kiểm tra hạn mức giao dịch trong ứng dụng ngân hàng của bạn."), List.of(
                                        single("Nên tải ứng dụng ngân hàng từ đâu?", null, "*CH Play / App Store", "Link trong tin nhắn", "Trang web lạ"),
                                        tf("Wi-Fi công cộng an toàn để giao dịch ngân hàng.", false, null),
                                        single("Khi mất điện thoại, nên làm gì với tài khoản ngân hàng?", null, "*Gọi tổng đài để khóa dịch vụ", "Chờ tìm lại", "Không làm gì"))),
                        new L("Tổng kết và bài kiểm tra cuối khóa", 55, p("Ôn tập toàn bộ khóa học."), null, List.of(
                                multi("Những việc giúp bảo vệ tài khoản?", null, "*Bật xác thực 2 lớp", "*Dùng mật khẩu khác nhau cho từng tài khoản", "Chia sẻ mã OTP cho người thân"),
                                tf("Cơ quan công an làm việc qua điện thoại và yêu cầu chuyển tiền.", false, null),
                                single("Số điện thoại tổng đài khẩn cấp của công an?", null, "*113", "114", "115"))))));
        list.add(new C("Sử dụng dịch vụ công trực tuyến và VNeID", "dvc", "tin-hoc", "BASIC",
                "Hướng dẫn tạo tài khoản định danh điện tử, nộp hồ sơ và thanh toán lệ phí trực tuyến.", gold, true, 0, null, List.of(
                        new L("Định danh điện tử là gì?", 30, p("Tài khoản định danh điện tử giúp bạn làm thủ tục hành chính trực tuyến."), null, List.of(
                                tf("Có thể dùng tài khoản định danh điện tử để đăng nhập Cổng dịch vụ công.", true, null),
                                single("Mức 2 của định danh điện tử cần?", null, "*Xác thực khuôn mặt tại cơ quan công an", "Chỉ cần số điện thoại", "Chỉ cần email"))),
                        new L("Nộp hồ sơ trực tuyến", 40, p("Chuẩn bị bản chụp giấy tờ rõ nét, điền đúng thông tin và theo dõi trạng thái hồ sơ."), p("Tra cứu một thủ tục hành chính bạn cần làm."), List.of(
                                single("Ảnh chụp giấy tờ cần?", null, "*Rõ nét, đủ 4 góc", "Mờ cũng được", "Chỉ cần nửa giấy tờ"),
                                tf("Sau khi nộp có thể tra cứu trạng thái hồ sơ trực tuyến.", true, null))),
                        new L("Thanh toán lệ phí trực tuyến", 25, p("Chọn phương thức thanh toán chính thức trên cổng, giữ lại biên lai điện tử."), null, List.of(
                                single("Sau khi thanh toán nên?", null, "*Lưu biên lai điện tử", "Xóa ngay tin nhắn", "Chụp màn hình gửi người lạ"))))));
        list.add(new C("Tiếng Anh giao tiếp hằng ngày", "ta-gt", "ngoai-ngu", "INTERMEDIATE",
                "Tự tin chào hỏi, hỏi đường, mua sắm và trò chuyện bằng tiếng Anh trong đời sống.", rose, true, 0, 28, List.of(
                        new L("Chào hỏi và giới thiệu bản thân", 40, p("Hello, my name is An. Nice to meet you!"), p("Ghi âm đoạn giới thiệu bản thân 30 giây."), List.of(
                                single("\"Nice to meet you\" nghĩa là?", null, "*Rất vui được gặp bạn", "Tạm biệt", "Cảm ơn"),
                                single("Câu hỏi tên lịch sự là?", null, "*What's your name?", "Who you?", "Name?"))),
                        new L("Hỏi đường", 40, p("Excuse me, where is the post office? Go straight and turn left."), null, List.of(
                                single("\"Turn left\" nghĩa là?", null, "*Rẽ trái", "Rẽ phải", "Đi thẳng"),
                                tf("\"Excuse me\" dùng để bắt chuyện lịch sự.", true, null))),
                        new L("Mua sắm", 45, p("How much is this? Can I pay by card?"), null, List.of(
                                single("Hỏi giá dùng câu nào?", null, "*How much is this?", "How are you?", "Where is it?"),
                                tf("\"Can I pay by card?\" là hỏi có thể trả bằng thẻ không.", true, null))),
                        new L("Gọi món ở nhà hàng", 40, p("I'd like a bowl of pho, please."), null, List.of(
                                single("\"I'd like...\" dùng để?", null, "*Gọi món lịch sự", "Từ chối", "Chào tạm biệt"))))));
        list.add(new C("Ứng dụng AI trong dạy học phổ thông", "ai", "su-pham", "ADVANCED",
                "Dùng các công cụ AI để soạn giáo án, tạo câu hỏi và cá nhân hóa việc học một cách có trách nhiệm.", ink, false, 10, null, List.of(
                        new L("AI là gì và không là gì", 40, p("AI tạo sinh có thể gợi ý nội dung nhưng có thể sai, giáo viên cần kiểm tra lại."), null, List.of(
                                tf("Nội dung do AI tạo ra luôn chính xác.", false, null),
                                single("Khi dùng AI soạn bài, giáo viên cần?", null, "*Kiểm tra, chỉnh sửa trước khi dùng", "Dùng nguyên văn", "Không cần đọc"))),
                        new L("Soạn câu hỏi trắc nghiệm với AI", 45, p("Mô tả rõ đối tượng, chủ đề, mức độ khi yêu cầu AI tạo câu hỏi."), null, List.of(
                                single("Yêu cầu tốt khi nhờ AI tạo câu hỏi cần có?", null, "*Đối tượng, chủ đề, số câu, mức độ", "Chỉ một từ khóa", "Không cần gì"))))));
        list.add(new C("Soạn thảo văn bản và bảng tính văn phòng", "may-tinh", "tin-hoc", "INTERMEDIATE",
                "Soạn văn bản đúng thể thức, lập bảng tính, dùng hàm cơ bản và in ấn.", amber, false, 0, null, List.of(
                        new L("Định dạng văn bản", 40, p("Căn lề, cỡ chữ, giãn dòng theo thể thức văn bản hành chính."), null, List.of(
                                single("Phím tắt in đậm?", null, "*Ctrl + B", "Ctrl + I", "Ctrl + U"))),
                        new L("Bảng tính và hàm SUM", 45, p("Hàm =SUM(A1:A10) tính tổng các ô từ A1 đến A10."), p("Lập bảng chi tiêu tháng và tính tổng."), List.of(
                                single("=SUM(B2:B5) làm gì?", null, "*Tính tổng B2 đến B5", "Đếm số ô", "Tìm giá trị lớn nhất"))),
                        new L("In ấn tài liệu", 25, p("Xem trước khi in, chọn khổ giấy A4 và hướng giấy phù hợp."), null, List.of()))));
        list.add(new C("Thiết kế bài giảng điện tử E-learning", "elearning", "su-pham", "INTERMEDIATE",
                "Xây dựng bài giảng điện tử có video, tương tác và câu hỏi kiểm tra.", deep, false, 0, null, List.of(
                        new L("Kịch bản bài giảng", 40, p("Xác định mục tiêu, nội dung, hoạt động và đánh giá cho từng bài."), null, List.of(
                                single("Bước đầu tiên khi thiết kế bài giảng?", null, "*Xác định mục tiêu bài học", "Chọn nhạc nền", "Chọn màu chữ"))),
                        new L("Quay và biên tập video ngắn", 45, p("Video nên ngắn 5–10 phút, âm thanh rõ."), null, List.of(
                                tf("Video bài giảng càng dài càng hiệu quả.", false, null))))));
        list.add(new C("Kỹ năng học tập suốt đời", "hoc-tap", "dao-tao", "BASIC",
                "Đặt mục tiêu, quản lý thời gian và tự học hiệu quả ở mọi lứa tuổi.", red, false, -1, null, List.of(
                        new L("Đặt mục tiêu học tập", 30, p("Mục tiêu tốt cần cụ thể, đo lường được và có thời hạn."), null, List.of(
                                single("Mục tiêu nào cụ thể nhất?", null, "*Học 20 phút tiếng Anh mỗi tối trong 1 tháng", "Giỏi tiếng Anh", "Học nhiều hơn"))),
                        new L("Quản lý thời gian", 30, p("Chia nhỏ việc học, nghỉ ngắn sau mỗi 25 phút."), null, List.of()))));
        list.add(new C("Thanh toán điện tử và mua sắm trực tuyến an toàn", "attt", "cntt", "BASIC",
                "Mua sắm trên sàn thương mại điện tử, thanh toán bằng ví điện tử và phòng tránh hàng giả.", amber, false, 0, null, List.of(
                        new L("Chọn nơi mua hàng uy tín", 30, p("Xem đánh giá người bán, chính sách đổi trả."), null, List.of(
                                single("Dấu hiệu người bán uy tín?", null, "*Nhiều đánh giá thật, có chính sách đổi trả", "Giá rẻ bất thường", "Yêu cầu chuyển khoản trước qua tài khoản cá nhân"))),
                        new L("Thanh toán bằng ví điện tử", 35, p("Bật mã PIN, không chia sẻ mã xác thực."), null, List.of(
                                tf("Nên chia sẻ mã xác thực ví điện tử cho người giao hàng.", false, null))))));
        list.add(new C("Sử dụng điện thoại thông minh hiệu quả", "may-tinh", "tin-hoc", "BASIC",
                "Cài đặt, cập nhật ứng dụng, chụp ảnh, gọi video và sao lưu dữ liệu trên điện thoại.", rose, false, 0, null, List.of(
                        new L("Cài đặt và cập nhật ứng dụng", 30, p("Chỉ cài ứng dụng từ CH Play/App Store, cập nhật thường xuyên."), null, List.of(
                                single("Nguồn cài ứng dụng an toàn?", null, "*Kho ứng dụng chính thức", "Link trong tin nhắn", "File APK lạ"))),
                        new L("Gọi video với người thân", 30, p("Dùng Zalo hoặc Messenger để gọi video."), p("Gọi video cho một người thân."), List.of()))));
        return list;
    }
}
