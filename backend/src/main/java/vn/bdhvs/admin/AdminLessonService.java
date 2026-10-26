package vn.bdhvs.admin;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import vn.bdhvs.common.audit.AuditService;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.util.Html;
import vn.bdhvs.common.util.Texts;

/** Bài học, tệp đính kèm, quiz và câu hỏi: FR-ADM-16, FR-ADM-17. */
@Service
public class AdminLessonService {

    private final JdbcClient db;
    private final AuditService audit;
    private final ObjectMapper json;

    public AdminLessonService(JdbcClient db, AuditService audit, ObjectMapper json) {
        this.db = db;
        this.audit = audit;
        this.json = json;
    }

    // ============================================================ bài học

    public record LessonRow(long id, int orderIndex, String title, Integer estimatedMinutes, boolean isPublished,
            Long quizId, int questionCount, int openedCount, int completedCount) {
    }

    public record AttachmentRef(long fileId, String displayName, String url, String contentType, long sizeBytes) {
    }

    public record LessonForm(long id, long courseId, int orderIndex, String title, String content, String videoUrl,
            String assignment, Integer estimatedMinutes, boolean isPublished, List<AttachmentRef> attachments,
            QuizForm quiz, int openedCount, int completedCount) {
    }

    public record AttachmentInput(@NotNull Long fileId, @Size(max = 255) String displayName) {
    }

    public record LessonRequest(@NotBlank(message = "Vui lòng nhập tên bài") @Size(max = 200) String title,
            String content, @Size(max = 500) String videoUrl, String assignment, @Min(0) Integer estimatedMinutes,
            Boolean isPublished, @Valid List<AttachmentInput> attachments) {
    }

    public record OrderItem(@NotNull Long id, @NotNull Integer orderIndex) {
    }

    public List<LessonRow> lessons(long courseId) {
        return db.sql("""
                SELECT l.id, l.order_index, l.title, l.estimated_minutes, l.is_published, q.id AS quiz_id,
                       (SELECT COUNT(*) FROM dbo.questions x WHERE x.quiz_id = q.id AND x.is_active = 1) AS question_count,
                       (SELECT COUNT(*) FROM dbo.lesson_progress lp WHERE lp.lesson_id = l.id) AS opened_count,
                       (SELECT COUNT(*) FROM dbo.lesson_progress lp WHERE lp.lesson_id = l.id AND lp.status = N'COMPLETED') AS completed_count
                FROM dbo.lessons l LEFT JOIN dbo.quizzes q ON q.lesson_id = l.id
                WHERE l.course_id = :c ORDER BY l.order_index""").param("c", courseId).query(LessonRow.class).list();
    }

    public LessonForm lesson(long id) {
        record L(long id, long courseId, int orderIndex, String title, String content, String videoUrl, String assignment,
                Integer estimatedMinutes, boolean isPublished) {
        }
        L l = db.sql("""
                SELECT id, course_id, order_index, title, content, video_url, assignment, estimated_minutes, is_published
                FROM dbo.lessons WHERE id = :id""").param("id", id).query(L.class).optional()
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy bài học"));
        List<AttachmentRef> att = db.sql("""
                SELECT f.id AS file_id, la.display_name, f.public_url AS url, f.content_type, f.size_bytes
                FROM dbo.lesson_attachments la JOIN dbo.uploaded_files f ON f.id = la.file_id
                WHERE la.lesson_id = :id ORDER BY la.order_index, la.id""").param("id", id).query(AttachmentRef.class).list();
        int opened = db.sql("SELECT COUNT(*) FROM dbo.lesson_progress WHERE lesson_id = :id").param("id", id).query(Integer.class).single();
        int completed = db.sql("SELECT COUNT(*) FROM dbo.lesson_progress WHERE lesson_id = :id AND status = N'COMPLETED'")
                .param("id", id).query(Integer.class).single();
        return new LessonForm(l.id(), l.courseId(), l.orderIndex(), l.title(), l.content(), l.videoUrl(), l.assignment(),
                l.estimatedMinutes(), l.isPublished(), att, quizForm(id), opened, completed);
    }

    @Transactional
    public long createLesson(long courseId, LessonRequest r, long actorId) {
        if (db.sql("SELECT COUNT(*) FROM dbo.courses WHERE id = :c").param("c", courseId).query(Integer.class).single() == 0) {
            throw ApiException.notFound("Không tìm thấy khóa học");
        }
        long id = db.sql("""
                INSERT INTO dbo.lessons (course_id, title, order_index, content, video_url, assignment, estimated_minutes, is_published)
                OUTPUT INSERTED.id
                VALUES (:c, :t, (SELECT ISNULL(MAX(order_index), 0) + 1 FROM dbo.lessons WITH (UPDLOCK) WHERE course_id = :c),
                        :content, :video, :assign, :mins, :pub)""")
                .param("c", courseId).param("t", r.title().trim()).param("content", Html.sanitize(r.content()))
                .param("video", videoUrl(r.videoUrl())).param("assign", Html.sanitize(r.assignment()))
                .param("mins", r.estimatedMinutes()).param("pub", Boolean.TRUE.equals(r.isPublished()))
                .query(Long.class).single();
        setAttachments(id, r.attachments());
        afterLessonChange(courseId);
        audit.log(actorId, "CREATE", "LESSON", id, null, Map.of("title", r.title(), "courseId", courseId));
        return id;
    }

    @Transactional
    public void updateLesson(long id, LessonRequest r, long actorId) {
        long courseId = courseOf(id);
        db.sql("""
                UPDATE dbo.lessons SET title = :t, content = :content, video_url = :video, assignment = :assign,
                    estimated_minutes = :mins, is_published = COALESCE(:pub, is_published), updated_at = SYSUTCDATETIME(),
                    version = version + 1 WHERE id = :id""")
                .param("t", r.title().trim()).param("content", Html.sanitize(r.content()))
                .param("video", videoUrl(r.videoUrl())).param("assign", Html.sanitize(r.assignment()))
                .param("mins", r.estimatedMinutes()).param("pub", r.isPublished()).param("id", id).update();
        if (r.attachments() != null) {
            setAttachments(id, r.attachments());
        }
        afterLessonChange(courseId);
        audit.log(actorId, "UPDATE", "LESSON", id, null, Map.of("title", r.title(), "isPublished", String.valueOf(r.isPublished())));
    }

    /** Bài đã có người học không xóa được, chỉ được ẩn (FR-ADM-16). */
    @Transactional
    public void deleteLesson(long id, long actorId) {
        long courseId = courseOf(id);
        int opened = db.sql("SELECT COUNT(*) FROM dbo.lesson_progress WHERE lesson_id = :id").param("id", id).query(Integer.class).single();
        int attempts = db.sql("""
                SELECT COUNT(*) FROM dbo.quiz_attempts a JOIN dbo.quizzes q ON q.id = a.quiz_id WHERE q.lesson_id = :id""")
                .param("id", id).query(Integer.class).single();
        if (opened > 0 || attempts > 0) {
            throw ApiException.conflict("LESSON_HAS_PROGRESS", "Bài học đã có người học nên không xóa được. Hãy chuyển sang ẩn (bỏ xuất bản)");
        }
        db.sql("UPDATE dbo.enrollments SET last_lesson_id = NULL WHERE last_lesson_id = :id").param("id", id).update();
        db.sql("DELETE FROM dbo.lessons WHERE id = :id").param("id", id).update();
        // Dồn lại thứ tự để không còn khoảng trống.
        db.sql("""
                WITH o AS (SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS rn FROM dbo.lessons WHERE course_id = :c)
                UPDATE l SET order_index = o.rn + 100000 FROM dbo.lessons l JOIN o ON o.id = l.id""").param("c", courseId).update();
        db.sql("UPDATE dbo.lessons SET order_index = order_index - 100000 WHERE course_id = :c").param("c", courseId).update();
        afterLessonChange(courseId);
        audit.log(actorId, "DELETE", "LESSON", id, null, null);
    }

    /** design-db 05 §7: cập nhật thứ tự trong một câu lệnh, qua 2 pha để tránh trùng UNIQUE giữa chừng. */
    @Transactional
    public void reorder(long courseId, List<OrderItem> items, long actorId) {
        String payload;
        try {
            payload = json.writeValueAsString(items);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        db.sql("UPDATE dbo.lessons SET order_index = order_index + 100000 WHERE course_id = :c").param("c", courseId).update();
        db.sql("""
                UPDATE l SET l.order_index = j.orderIndex, l.updated_at = SYSUTCDATETIME(), l.version = l.version + 1
                FROM dbo.lessons l JOIN OPENJSON(:j) WITH (id BIGINT '$.id', orderIndex INT '$.orderIndex') j ON j.id = l.id
                WHERE l.course_id = :c""").param("j", payload).param("c", courseId).update();
        int leftover = db.sql("SELECT COUNT(*) FROM dbo.lessons WHERE course_id = :c AND order_index > 100000")
                .param("c", courseId).query(Integer.class).single();
        if (leftover > 0) {
            throw ApiException.validation("items", "Danh sách sắp xếp phải gồm đầy đủ các bài học của khóa");
        }
        afterLessonChange(courseId);
        audit.log(actorId, "UPDATE", "COURSE", courseId, null, Map.of("reorderLessons", items));
    }

    private long courseOf(long lessonId) {
        return db.sql("SELECT course_id FROM dbo.lessons WHERE id = :id").param("id", lessonId).query(Long.class)
                .optional().orElseThrow(() -> ApiException.notFound("Không tìm thấy bài học"));
    }

    private static String videoUrl(String url) {
        String u = Texts.trimToNull(url);
        if (u != null && !u.startsWith("https://") && !u.startsWith("/files/")) {
            throw ApiException.validation("videoUrl", "Đường dẫn video phải bắt đầu bằng https:// hoặc là tệp đã tải lên");
        }
        return u;
    }

    private void setAttachments(long lessonId, List<AttachmentInput> attachments) {
        db.sql("DELETE FROM dbo.lesson_attachments WHERE lesson_id = :id").param("id", lessonId).update();
        if (attachments == null) {
            return;
        }
        int i = 0;
        Set<Long> seen = new HashSet<>();
        for (AttachmentInput a : attachments) {
            if (!seen.add(a.fileId())) {
                continue;
            }
            String name = Texts.trimToNull(a.displayName());
            db.sql("""
                    INSERT INTO dbo.lesson_attachments (lesson_id, file_id, display_name, order_index)
                    SELECT :l, f.id, COALESCE(:n, f.original_name), :i FROM dbo.uploaded_files f WHERE f.id = :f""")
                    .param("l", lessonId).param("n", name).param("i", i++).param("f", a.fileId()).update();
        }
    }

    /** Cập nhật cột tổng hợp và tiến độ mọi học viên khi bài học thay đổi (FR-LRN-08, design-db 05 §5). */
    private void afterLessonChange(long courseId) {
        db.sql("""
                UPDATE dbo.courses SET published_lesson_count = (SELECT COUNT(*) FROM dbo.lessons WHERE course_id = :c AND is_published = 1),
                    updated_at = SYSUTCDATETIME() WHERE id = :c""").param("c", courseId).update();
        db.sql("""
                UPDATE e
                SET e.completed_lesson_count = x.done,
                    e.progress_percent = CASE WHEN x.total = 0 THEN 0 WHEN x.done >= x.total THEN 100 ELSE x.done * 100 / x.total END,
                    e.status = CASE WHEN e.status = N'IN_PROGRESS' AND x.total > 0 AND x.done >= x.total THEN N'COMPLETED' ELSE e.status END,
                    e.completed_at = CASE WHEN e.status = N'IN_PROGRESS' AND x.total > 0 AND x.done >= x.total
                                          THEN SYSUTCDATETIME() ELSE e.completed_at END,
                    e.updated_at = SYSUTCDATETIME()
                FROM dbo.enrollments e
                CROSS APPLY (
                    SELECT COUNT(*) AS total, ISNULL(SUM(CASE WHEN lp.status = N'COMPLETED' THEN 1 ELSE 0 END), 0) AS done
                    FROM dbo.lessons l LEFT JOIN dbo.lesson_progress lp ON lp.lesson_id = l.id AND lp.enrollment_id = e.id
                    WHERE l.course_id = e.course_id AND l.is_published = 1) x
                WHERE e.course_id = :c AND e.status IN (N'IN_PROGRESS', N'COMPLETED')""").param("c", courseId).update();
    }

    // ============================================================ quiz

    public record QuizForm(long id, String title, int passScorePercent, Integer timeLimitMinutes, Integer maxAttempts,
            int retryCooldownMinutes, boolean shuffleQuestions, boolean shuffleOptions, boolean showAnswersAfterSubmit,
            int attemptCount, List<QuestionForm> questions) {
    }

    public record QuizRequest(@Size(max = 200) String title,
            @NotNull @Min(0) @Max(100) Integer passScorePercent,
            @Min(1) Integer timeLimitMinutes,
            @Min(1) Integer maxAttempts,
            @Min(0) Integer retryCooldownMinutes,
            Boolean shuffleQuestions, Boolean shuffleOptions, Boolean showAnswersAfterSubmit) {
    }

    public record OptionForm(long id, String content, boolean isCorrect, int orderIndex) {
    }

    public record QuestionForm(long id, String content, String type, BigDecimal points, String explanation,
            int orderIndex, int answerCount, List<OptionForm> options) {
    }

    public record OptionInput(Long id, @NotBlank(message = "Đáp án không được để trống") @Size(max = 1000) String content,
            boolean isCorrect) {
    }

    public record QuestionRequest(@NotBlank(message = "Vui lòng nhập nội dung câu hỏi") String content,
            @NotBlank @Pattern(regexp = "SINGLE_CHOICE|MULTIPLE_CHOICE|TRUE_FALSE") String type,
            @DecimalMin(value = "0.01", message = "Điểm phải lớn hơn 0") BigDecimal points, String explanation,
            Integer orderIndex, @Valid @NotNull List<OptionInput> options) {
    }

    public QuizForm quizForm(long lessonId) {
        record Q(long id, String title, int passScorePercent, Integer timeLimitSeconds, Integer maxAttempts,
                int retryCooldownSeconds, boolean shuffleQuestions, boolean shuffleOptions, boolean showAnswersAfterSubmit) {
        }
        Q q = db.sql("""
                SELECT id, title, pass_score_percent, time_limit_seconds, max_attempts, retry_cooldown_seconds,
                       shuffle_questions, shuffle_options, show_answers_after_submit FROM dbo.quizzes WHERE lesson_id = :l""")
                .param("l", lessonId).query(Q.class).optional().orElse(null);
        if (q == null) {
            return null;
        }
        int attempts = db.sql("SELECT COUNT(*) FROM dbo.quiz_attempts WHERE quiz_id = :q").param("q", q.id()).query(Integer.class).single();
        return new QuizForm(q.id(), q.title(), q.passScorePercent(),
                q.timeLimitSeconds() == null ? null : q.timeLimitSeconds() / 60, q.maxAttempts(), q.retryCooldownSeconds() / 60,
                q.shuffleQuestions(), q.shuffleOptions(), q.showAnswersAfterSubmit(), attempts, questions(q.id()));
    }

    public List<QuestionForm> questions(long quizId) {
        record Q(long id, String content, String questionType, BigDecimal points, String explanation, int orderIndex,
                int answerCount) {
        }
        List<Q> qs = db.sql("""
                SELECT q.id, q.content, q.question_type, q.points, q.explanation, q.order_index,
                       (SELECT COUNT(*) FROM dbo.quiz_attempt_answers a WHERE a.question_id = q.id) AS answer_count
                FROM dbo.questions q WHERE q.quiz_id = :q AND q.is_active = 1 ORDER BY q.order_index, q.id""")
                .param("q", quizId).query(Q.class).list();
        Map<Long, List<OptionForm>> opts = new HashMap<>();
        db.sql("""
                SELECT o.question_id, o.id, o.content, o.is_correct, o.order_index FROM dbo.question_options o
                JOIN dbo.questions q ON q.id = o.question_id WHERE q.quiz_id = :q AND o.is_active = 1 ORDER BY o.order_index, o.id""")
                .param("q", quizId).query((rs, i) -> opts.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>())
                        .add(new OptionForm(rs.getLong(2), rs.getString(3), rs.getBoolean(4), rs.getInt(5)))).list();
        return qs.stream().map(q -> new QuestionForm(q.id(), q.content(), q.questionType(), q.points(), q.explanation(),
                q.orderIndex(), q.answerCount(), opts.getOrDefault(q.id(), List.of()))).toList();
    }

    @Transactional
    public QuizForm upsertQuiz(long lessonId, QuizRequest r, long actorId) {
        String title = r.title() == null || r.title().isBlank()
                ? "Quiz: " + db.sql("SELECT title FROM dbo.lessons WHERE id = :id").param("id", lessonId).query(String.class)
                        .optional().orElseThrow(() -> ApiException.notFound("Không tìm thấy bài học"))
                : r.title().trim();
        Map<String, Object> p = new HashMap<>();
        p.put("l", lessonId);
        p.put("t", title.length() > 200 ? title.substring(0, 200) : title);
        p.put("pass", r.passScorePercent());
        p.put("limit", r.timeLimitMinutes() == null ? null : r.timeLimitMinutes() * 60);
        p.put("max", r.maxAttempts());
        p.put("cool", r.retryCooldownMinutes() == null ? 0 : r.retryCooldownMinutes() * 60);
        p.put("sq", Boolean.TRUE.equals(r.shuffleQuestions()));
        p.put("so", Boolean.TRUE.equals(r.shuffleOptions()));
        p.put("show", r.showAnswersAfterSubmit() == null || r.showAnswersAfterSubmit());
        int n = db.sql("""
                UPDATE dbo.quizzes SET title = :t, pass_score_percent = :pass, time_limit_seconds = :limit, max_attempts = :max,
                    retry_cooldown_seconds = :cool, shuffle_questions = :sq, shuffle_options = :so, show_answers_after_submit = :show,
                    updated_at = SYSUTCDATETIME(), version = version + 1 WHERE lesson_id = :l""").params(p).update();
        if (n == 0) {
            db.sql("""
                    INSERT INTO dbo.quizzes (lesson_id, title, pass_score_percent, time_limit_seconds, max_attempts,
                        retry_cooldown_seconds, shuffle_questions, shuffle_options, show_answers_after_submit)
                    VALUES (:l, :t, :pass, :limit, :max, :cool, :sq, :so, :show)""").params(p).update();
        }
        audit.log(actorId, n == 0 ? "CREATE" : "UPDATE", "QUIZ", lessonId, null, r);
        return quizForm(lessonId);
    }

    @Transactional
    public void deleteQuiz(long lessonId, long actorId) {
        Long quizId = db.sql("SELECT id FROM dbo.quizzes WHERE lesson_id = :l").param("l", lessonId).query(Long.class)
                .optional().orElseThrow(() -> ApiException.notFound("Bài học chưa có quiz"));
        int attempts = db.sql("SELECT COUNT(*) FROM dbo.quiz_attempts WHERE quiz_id = :q").param("q", quizId).query(Integer.class).single();
        if (attempts > 0) {
            throw ApiException.conflict("QUIZ_HAS_ATTEMPTS", "Quiz đã có người làm nên không xóa được");
        }
        db.sql("DELETE FROM dbo.quizzes WHERE id = :q").param("q", quizId).update();
        audit.log(actorId, "DELETE", "QUIZ", quizId, null, null);
    }

    /** FR-ADM-17: 2–8 đáp án; một đáp án / Đúng-Sai có đúng 1 đáp án đúng; nhiều đáp án có ≥ 1. */
    private static void validateQuestion(QuestionRequest r) {
        int count = r.options().size();
        long correct = r.options().stream().filter(OptionInput::isCorrect).count();
        if ("TRUE_FALSE".equals(r.type()) && count != 2) {
            throw ApiException.validation("options", "Câu Đúng/Sai phải có đúng 2 đáp án");
        }
        if (count < 2 || count > 8) {
            throw ApiException.validation("options", "Mỗi câu hỏi cần từ 2 đến 8 đáp án");
        }
        if (!"MULTIPLE_CHOICE".equals(r.type()) && correct != 1) {
            throw ApiException.validation("options", "Câu một đáp án / Đúng-Sai phải có đúng 1 đáp án đúng");
        }
        if ("MULTIPLE_CHOICE".equals(r.type()) && correct < 1) {
            throw ApiException.validation("options", "Câu nhiều đáp án cần ít nhất 1 đáp án đúng");
        }
    }

    @Transactional
    public QuestionForm createQuestion(long quizId, QuestionRequest r, long actorId) {
        validateQuestion(r);
        if (db.sql("SELECT COUNT(*) FROM dbo.quizzes WHERE id = :q").param("q", quizId).query(Integer.class).single() == 0) {
            throw ApiException.notFound("Không tìm thấy quiz");
        }
        long id = db.sql("""
                INSERT INTO dbo.questions (quiz_id, content, question_type, points, explanation, order_index)
                OUTPUT INSERTED.id
                VALUES (:q, :c, :t, :p, :e, COALESCE(:o, (SELECT ISNULL(MAX(order_index), 0) + 1 FROM dbo.questions WHERE quiz_id = :q)))""")
                .param("q", quizId).param("c", Html.sanitize(r.content())).param("t", r.type())
                .param("p", r.points() == null ? BigDecimal.ONE : r.points()).param("e", Html.sanitize(r.explanation()))
                .param("o", r.orderIndex()).query(Long.class).single();
        int i = 0;
        for (OptionInput o : r.options()) {
            insertOption(id, o, i++);
        }
        audit.log(actorId, "CREATE", "QUESTION", id, null, Map.of("quizId", quizId));
        return questions(quizId).stream().filter(q -> q.id() == id).findFirst().orElseThrow();
    }

    private void insertOption(long questionId, OptionInput o, int order) {
        db.sql("INSERT INTO dbo.question_options (question_id, content, is_correct, order_index) VALUES (:q, :c, :ok, :o)")
                .param("q", questionId).param("c", o.content().trim()).param("ok", o.isCorrect()).param("o", order).update();
    }

    /**
     * Sửa câu hỏi. Đáp án đã có người chọn không xóa cứng mà chỉ tắt (is_active = 0) để giữ lịch sử.
     * Đổi đáp án đúng khi đã có lượt trả lời: Admin cần chạy "Tính lại xếp hạng" (FR-ADM-17).
     */
    @Transactional
    public QuestionForm updateQuestion(long id, QuestionRequest r, long actorId) {
        validateQuestion(r);
        Long quizId = db.sql("SELECT quiz_id FROM dbo.questions WHERE id = :id AND is_active = 1").param("id", id)
                .query(Long.class).optional().orElseThrow(() -> ApiException.notFound("Không tìm thấy câu hỏi"));
        db.sql("""
                UPDATE dbo.questions SET content = :c, question_type = :t, points = :p, explanation = :e,
                    order_index = COALESCE(:o, order_index), updated_at = SYSUTCDATETIME(), version = version + 1 WHERE id = :id""")
                .param("c", Html.sanitize(r.content())).param("t", r.type()).param("p", r.points() == null ? BigDecimal.ONE : r.points())
                .param("e", Html.sanitize(r.explanation())).param("o", r.orderIndex()).param("id", id).update();
        List<Long> existing = db.sql("SELECT id FROM dbo.question_options WHERE question_id = :q AND is_active = 1")
                .param("q", id).query(Long.class).list();
        Set<Long> kept = new HashSet<>();
        int i = 0;
        for (OptionInput o : r.options()) {
            if (o.id() != null && existing.contains(o.id())) {
                kept.add(o.id());
                db.sql("UPDATE dbo.question_options SET content = :c, is_correct = :ok, order_index = :o, updated_at = SYSUTCDATETIME() WHERE id = :id")
                        .param("c", o.content().trim()).param("ok", o.isCorrect()).param("o", i++).param("id", o.id()).update();
            } else {
                insertOption(id, o, i++);
            }
        }
        for (Long optId : existing) {
            if (!kept.contains(optId)) {
                int used = db.sql("SELECT COUNT(*) FROM dbo.quiz_attempt_answer_options WHERE option_id = :o").param("o", optId)
                        .query(Integer.class).single();
                if (used > 0) {
                    db.sql("UPDATE dbo.question_options SET is_active = 0, updated_at = SYSUTCDATETIME() WHERE id = :o").param("o", optId).update();
                } else {
                    db.sql("DELETE FROM dbo.question_options WHERE id = :o").param("o", optId).update();
                }
            }
        }
        audit.log(actorId, "UPDATE", "QUESTION", id, null, Map.of("quizId", quizId));
        return questions(quizId).stream().filter(q -> q.id() == id).findFirst().orElseThrow();
    }

    @Transactional
    public void deleteQuestion(long id, long actorId) {
        int answered = db.sql("SELECT COUNT(*) FROM dbo.quiz_attempt_answers WHERE question_id = :id").param("id", id)
                .query(Integer.class).single();
        int n = answered > 0
                ? db.sql("UPDATE dbo.questions SET is_active = 0, updated_at = SYSUTCDATETIME() WHERE id = :id").param("id", id).update()
                : db.sql("DELETE FROM dbo.questions WHERE id = :id").param("id", id).update();
        if (n == 0) {
            throw ApiException.notFound("Không tìm thấy câu hỏi");
        }
        audit.log(actorId, "DELETE", "QUESTION", id, null, Map.of("softDeleted", answered > 0));
    }

    public record ImportResult(int created, List<String> errors) {
    }

    /**
     * Nhập câu hỏi hàng loạt từ CSV UTF-8 (FR-ADM-17, mức S). Mỗi dòng:
     * loai;noi_dung;diem;giai_thich;dap_an_1;...;dap_an_n — đáp án đúng đánh dấu bằng tiền tố "*".
     */
    @Transactional
    public ImportResult importCsv(long quizId, String csv, long actorId) {
        List<String> errors = new ArrayList<>();
        int created = 0;
        String[] lines = csv.replace("﻿", "").split("\\r?\\n");
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty() || (i == 0 && line.toLowerCase().startsWith("loai"))) {
                continue;
            }
            String[] cols = line.split(";", -1);
            try {
                if (cols.length < 6) {
                    throw ApiException.validation("csv", "cần ít nhất 6 cột");
                }
                List<OptionInput> options = new ArrayList<>();
                for (int c = 4; c < cols.length; c++) {
                    String v = cols[c].trim();
                    if (!v.isEmpty()) {
                        options.add(new OptionInput(null, v.startsWith("*") ? v.substring(1).trim() : v, v.startsWith("*")));
                    }
                }
                QuestionRequest r = new QuestionRequest(cols[1].trim(), cols[0].trim().toUpperCase(),
                        cols[2].isBlank() ? BigDecimal.ONE : new BigDecimal(cols[2].trim()), Texts.trimToNull(cols[3]), null, options);
                if (!r.type().matches("SINGLE_CHOICE|MULTIPLE_CHOICE|TRUE_FALSE")) {
                    throw ApiException.validation("type", "loại câu hỏi không hợp lệ");
                }
                createQuestion(quizId, r, actorId);
                created++;
            } catch (ApiException e) {
                String detail = e.errors().isEmpty() ? e.getMessage() : e.errors().get(0).message();
                errors.add("Dòng " + (i + 1) + ": " + detail);
            } catch (NumberFormatException e) {
                errors.add("Dòng " + (i + 1) + ": điểm không hợp lệ");
            }
        }
        audit.log(actorId, "IMPORT", "QUIZ", quizId, null, Map.of("created", created, "errors", errors.size()));
        return new ImportResult(created, errors);
    }
}
