package vn.bdhvs.learning;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import vn.bdhvs.catalog.CatalogDtos.LessonItem;
import vn.bdhvs.catalog.CatalogDtos.MyRank;
import vn.bdhvs.catalog.CatalogService;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.util.Db;
import vn.bdhvs.common.util.Secrets;
import vn.bdhvs.learning.LearningAccess.Access;
import vn.bdhvs.learning.LearningDtos.AnswerInput;
import vn.bdhvs.learning.LearningDtos.AttemptHistoryItem;
import vn.bdhvs.learning.LearningDtos.AttemptResult;
import vn.bdhvs.learning.LearningDtos.AttemptView;
import vn.bdhvs.learning.LearningDtos.LessonRef;
import vn.bdhvs.learning.LearningDtos.OptionView;
import vn.bdhvs.learning.LearningDtos.QuestionView;
import vn.bdhvs.learning.LearningDtos.RankingInfo;
import vn.bdhvs.learning.LearningDtos.ResultOption;
import vn.bdhvs.learning.LearningDtos.ResultQuestion;
import vn.bdhvs.learning.LearningDtos.SubmitResult;
import vn.bdhvs.ranking.RankingService;

/** Làm quiz: FR-LRN-04..06, 10; BR-LRN-03..05; FR-RNK-03. */
@Service
public class QuizService {

    private static final Logger log = LoggerFactory.getLogger(QuizService.class);
    /** Bù độ trễ mạng khi hết giờ (FR-LRN-04 bước 6). */
    private static final int GRACE_SECONDS = 30;

    private final JdbcClient db;
    private final ObjectMapper json;
    private final LearningAccess access;
    private final CatalogService catalog;
    private final ProgressService progress;
    private final RankingService ranking;
    private final TransactionTemplate tx;

    public QuizService(JdbcClient db, ObjectMapper json, LearningAccess access, CatalogService catalog,
            ProgressService progress, RankingService ranking, TransactionTemplate tx) {
        this.db = db;
        this.json = json;
        this.access = access;
        this.catalog = catalog;
        this.progress = progress;
        this.ranking = ranking;
        this.tx = tx;
    }

    /** Thứ tự câu/đáp án đã xáo cho một lượt, lưu ở quiz_attempts.question_order. */
    public record OrderItem(long q, List<Long> o) {
    }

    record QuizRow(long id, long lessonId, long courseId, String title, int passScorePercent, Integer timeLimitSeconds,
            Integer maxAttempts, int retryCooldownSeconds, boolean shuffleQuestions, boolean shuffleOptions,
            boolean showAnswersAfterSubmit) {
    }

    record AttemptRow(long id, long quizId, long userId, long enrollmentId, int attemptNo, String status,
            String questionOrder, Instant startedAt, Instant expiresAt, Instant submittedAt, Integer durationSeconds,
            BigDecimal score, BigDecimal maxScore, BigDecimal scorePercent, Boolean passed) {
    }

    private QuizRow quiz(long quizId) {
        return db.sql("""
                SELECT q.id, q.lesson_id, l.course_id, q.title, q.pass_score_percent, q.time_limit_seconds, q.max_attempts,
                       q.retry_cooldown_seconds, q.shuffle_questions, q.shuffle_options, q.show_answers_after_submit
                FROM dbo.quizzes q JOIN dbo.lessons l ON l.id = q.lesson_id WHERE q.id = :id AND l.is_published = 1""")
                .param("id", quizId).query(QuizRow.class).optional()
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy bài quiz"));
    }

    private AttemptRow attempt(long attemptId, long userId, boolean lock) {
        return db.sql("""
                SELECT id, quiz_id, user_id, enrollment_id, attempt_no, status, question_order, started_at, expires_at,
                       submitted_at, duration_seconds, score, max_score, score_percent, passed
                FROM dbo.quiz_attempts""" + (lock ? " WITH (UPDLOCK)" : "") + " WHERE id = :id")
                .param("id", attemptId).query(AttemptRow.class).optional()
                .filter(a -> a.userId() == userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy lượt làm bài"));
    }

    private void requireUnlocked(long courseId, long enrollmentId, long lessonId) {
        LessonItem item = catalog.lessonStates(courseId, enrollmentId).stream().filter(l -> l.id() == lessonId)
                .findFirst().orElseThrow(() -> ApiException.notFound("Không tìm thấy bài học"));
        if ("LOCKED".equals(item.state())) {
            throw ApiException.forbidden("LESSON_LOCKED", "Hoàn thành bài trước để mở khóa bài này");
        }
    }

    // ---------------------------------------------------------------- bắt đầu

    /** FR-LRN-04 bước 2 + FR-LRN-06: tạo lượt mới, hoặc trả lượt đang làm dở. */
    @Transactional
    public long start(long quizId, long userId) {
        QuizRow q = quiz(quizId);
        Access a = access.require(q.courseId(), userId);
        requireUnlocked(q.courseId(), a.enrollmentId(), q.lessonId());
        progress.markOpened(a.enrollmentId(), q.lessonId());

        AttemptRow current = db.sql("""
                SELECT id, quiz_id, user_id, enrollment_id, attempt_no, status, question_order, started_at, expires_at,
                       submitted_at, duration_seconds, score, max_score, score_percent, passed
                FROM dbo.quiz_attempts WITH (UPDLOCK, HOLDLOCK) WHERE user_id = :u AND quiz_id = :q AND status = N'IN_PROGRESS'""")
                .param("u", userId).param("q", quizId).query(AttemptRow.class).optional().orElse(null);
        if (current != null) {
            if (current.expiresAt() == null || current.expiresAt().isAfter(Instant.now())) {
                return current.id();
            }
            finalizeAttempt(current, q, "EXPIRED");
        }
        record Stat(int used, Instant lastSubmitted) {
        }
        Stat s = db.sql("""
                SELECT COUNT(*) AS used, MAX(submitted_at) AS last_submitted FROM dbo.quiz_attempts
                WHERE quiz_id = :q AND enrollment_id = :e AND status IN (N'SUBMITTED', N'EXPIRED')""")
                .param("q", quizId).param("e", a.enrollmentId()).query(Stat.class).single();
        if (q.maxAttempts() != null && s.used() >= q.maxAttempts()) {
            throw ApiException.unprocessable("MAX_ATTEMPTS_REACHED", "Bạn đã dùng hết số lần làm bài cho quiz này");
        }
        if (s.lastSubmitted() != null && q.retryCooldownSeconds() > 0
                && s.lastSubmitted().plusSeconds(q.retryCooldownSeconds()).isAfter(Instant.now())) {
            long wait = Duration.between(Instant.now(), s.lastSubmitted().plusSeconds(q.retryCooldownSeconds())).toMinutes() + 1;
            throw ApiException.unprocessable("QUIZ_COOLDOWN", "Bạn có thể làm lại sau khoảng " + wait + " phút");
        }

        Map<Long, List<Long>> structure = new LinkedHashMap<>();
        db.sql("""
                SELECT q.id AS question_id, o.id AS option_id FROM dbo.questions q
                JOIN dbo.question_options o ON o.question_id = q.id AND o.is_active = 1
                WHERE q.quiz_id = :q AND q.is_active = 1 ORDER BY q.order_index, q.id, o.order_index, o.id""")
                .param("q", quizId)
                .query((rs, i) -> structure.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getLong(2)))
                .list();
        if (structure.isEmpty()) {
            throw ApiException.unprocessable("QUIZ_EMPTY", "Bài quiz chưa có câu hỏi");
        }
        List<OrderItem> order = new ArrayList<>();
        structure.forEach((qid, opts) -> {
            List<Long> o = new ArrayList<>(opts);
            if (q.shuffleOptions()) {
                shuffle(o);
            }
            order.add(new OrderItem(qid, o));
        });
        if (q.shuffleQuestions()) {
            shuffle(order);
        }
        int attemptNo = db.sql("SELECT ISNULL(MAX(attempt_no), 0) + 1 FROM dbo.quiz_attempts WHERE user_id = :u AND quiz_id = :q")
                .param("u", userId).param("q", quizId).query(Integer.class).single();
        Instant expires = q.timeLimitSeconds() == null ? null : Instant.now().plusSeconds(q.timeLimitSeconds() + GRACE_SECONDS);
        return db.sql("""
                INSERT INTO dbo.quiz_attempts (quiz_id, user_id, enrollment_id, attempt_no, question_order, expires_at)
                OUTPUT INSERTED.id VALUES (:q, :u, :e, :no, :order, :exp)""")
                .param("q", quizId).param("u", userId).param("e", a.enrollmentId()).param("no", attemptNo)
                .param("order", toJson(order)).param("exp", Db.ts(expires)).query(Long.class).single();
    }

    private static <T> void shuffle(List<T> list) {
        for (int i = list.size() - 1; i > 0; i--) {
            Collections.swap(list, i, Secrets.nextInt(i + 1));
        }
    }

    // ---------------------------------------------------------------- làm bài

    public AttemptView view(long attemptId, long userId) {
        AttemptRow at = attempt(attemptId, userId, false);
        QuizRow q = quiz(at.quizId());
        Access a = access.require(q.courseId(), userId);
        if (!"IN_PROGRESS".equals(at.status())) {
            throw ApiException.conflict("ATTEMPT_SUBMITTED", "Lượt làm bài này đã nộp");
        }
        List<OrderItem> order = parseOrder(at.questionOrder());
        Map<Long, QuestionRow> questions = questions(order);
        Map<Long, String> optionText = new HashMap<>();
        db.sql("SELECT id, content FROM dbo.question_options WHERE question_id IN (:ids)")
                .param("ids", order.stream().map(OrderItem::q).toList())
                .query((rs, i) -> optionText.put(rs.getLong(1), rs.getString(2))).list();
        // BR-LRN-04: tuyệt đối không gửi is_correct về client.
        List<QuestionView> views = order.stream().filter(o -> questions.containsKey(o.q())).map(o -> {
            QuestionRow qr = questions.get(o.q());
            return new QuestionView(qr.id(), qr.content(), qr.questionType(), qr.points(),
                    o.o().stream().map(oid -> new OptionView(oid, optionText.get(oid))).toList());
        }).toList();
        Map<Long, List<Long>> saved = savedAnswers(attemptId);
        List<AnswerInput> answers = saved.entrySet().stream().map(e -> new AnswerInput(e.getKey(), e.getValue())).toList();
        return new AttemptView(at.id(), q.id(), q.lessonId(), a.courseSlug(), q.title(), at.attemptNo(), at.status(),
                at.startedAt(), at.expiresAt(), a.expiresAt(), q.passScorePercent(), views, answers);
    }

    record QuestionRow(long id, String content, String questionType, BigDecimal points, String explanation) {
    }

    private Map<Long, QuestionRow> questions(List<OrderItem> order) {
        Map<Long, QuestionRow> map = new HashMap<>();
        if (order.isEmpty()) {
            return map;
        }
        db.sql("SELECT id, content, question_type, points, explanation FROM dbo.questions WHERE id IN (:ids)")
                .param("ids", order.stream().map(OrderItem::q).toList()).query(QuestionRow.class).list()
                .forEach(r -> map.put(r.id(), r));
        return map;
    }

    private Map<Long, List<Long>> savedAnswers(long attemptId) {
        Map<Long, List<Long>> map = new LinkedHashMap<>();
        db.sql("""
                SELECT a.question_id, ao.option_id FROM dbo.quiz_attempt_answers a
                LEFT JOIN dbo.quiz_attempt_answer_options ao ON ao.answer_id = a.id
                WHERE a.attempt_id = :id ORDER BY a.id""").param("id", attemptId)
                .query((rs, i) -> {
                    List<Long> l = map.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>());
                    long opt = rs.getLong(2);
                    if (!rs.wasNull()) {
                        l.add(opt);
                    }
                    return null;
                }).list();
        return map;
    }

    /** FR-LRN-04 bước 7: lưu nháp đáp án. */
    @Transactional
    public void saveAnswers(long attemptId, long userId, List<AnswerInput> answers) {
        AttemptRow at = attempt(attemptId, userId, true);
        QuizRow q = quiz(at.quizId());
        access.require(q.courseId(), userId);
        if (!"IN_PROGRESS".equals(at.status())) {
            throw ApiException.conflict("ATTEMPT_SUBMITTED", "Lượt làm bài này đã nộp");
        }
        if (at.expiresAt() != null && at.expiresAt().isBefore(Instant.now())) {
            throw ApiException.unprocessable("ATTEMPT_EXPIRED", "Đã hết thời gian làm bài");
        }
        storeAnswers(at, answers);
    }

    private void storeAnswers(AttemptRow at, List<AnswerInput> answers) {
        if (answers == null) {
            return;
        }
        Map<Long, Set<Long>> allowed = new HashMap<>();
        parseOrder(at.questionOrder()).forEach(o -> allowed.put(o.q(), new HashSet<>(o.o())));
        for (AnswerInput in : answers) {
            Set<Long> opts = allowed.get(in.questionId());
            if (opts == null) {
                continue;
            }
            List<Long> selected = in.selectedOptionIds() == null ? List.of()
                    : in.selectedOptionIds().stream().filter(opts::contains).distinct().toList();
            Long answerId = db.sql("SELECT id FROM dbo.quiz_attempt_answers WITH (UPDLOCK) WHERE attempt_id = :a AND question_id = :q")
                    .param("a", at.id()).param("q", in.questionId()).query(Long.class).optional().orElse(null);
            if (answerId == null) {
                answerId = db.sql("INSERT INTO dbo.quiz_attempt_answers (attempt_id, question_id) OUTPUT INSERTED.id VALUES (:a, :q)")
                        .param("a", at.id()).param("q", in.questionId()).query(Long.class).single();
            } else {
                db.sql("UPDATE dbo.quiz_attempt_answers SET answered_at = SYSUTCDATETIME() WHERE id = :id").param("id", answerId).update();
            }
            db.sql("DELETE FROM dbo.quiz_attempt_answer_options WHERE answer_id = :id").param("id", answerId).update();
            for (Long opt : selected) {
                db.sql("INSERT INTO dbo.quiz_attempt_answer_options (answer_id, option_id) VALUES (:a, :o)")
                        .param("a", answerId).param("o", opt).update();
            }
        }
    }

    // ---------------------------------------------------------------- nộp bài & chấm

    /** FR-LRN-05 + FR-RNK-03: chấm, cập nhật tiến độ và xếp hạng trong một transaction. */
    @Transactional
    public SubmitResult submit(long attemptId, long userId, List<AnswerInput> answers) {
        AttemptRow at = attempt(attemptId, userId, true);
        QuizRow q = quiz(at.quizId());
        Access a = access.require(q.courseId(), userId);
        if (!"IN_PROGRESS".equals(at.status())) {
            throw ApiException.conflict("ATTEMPT_SUBMITTED", "Lượt làm bài này đã được nộp");
        }
        boolean inTime = at.expiresAt() == null || !at.expiresAt().isBefore(Instant.now());
        if (inTime) {
            storeAnswers(at, answers);
        }
        // Quá giờ (kể cả 30 giây bù trễ): chỉ chấm các câu đã lưu nháp.
        Graded g = finalizeAttempt(at, q, inTime ? "SUBMITTED" : "EXPIRED");
        MyRank rank = ranking.myRank(q.courseId(), userId);
        return new SubmitResult(at.id(), g.score(), g.maxScore(), g.percent(), g.passed(), g.duration(), g.correct(),
                g.total(), g.lessonCompleted(), g.lessonCompleted() || g.passed()
                        ? progress.nextUnlocked(q.courseId(), a.enrollmentId(), q.lessonId()) : null,
                g.progressPercent(), g.courseCompleted(),
                rank.rank() == null ? null : new RankingInfo(rank.rank(), rank.totalScore(), rank.totalDurationSeconds()));
    }

    record Graded(BigDecimal score, BigDecimal maxScore, BigDecimal percent, boolean passed, int duration,
            int correct, int total, boolean lessonCompleted, int progressPercent, boolean courseCompleted) {
    }

    record Grade(BigDecimal score, BigDecimal maxScore, BigDecimal percent, int correct, int total) {
    }

    /** BR-LRN-03: đúng khi tập đáp án chọn trùng khớp tập đáp án đúng; không chấm điểm từng phần. */
    private Grade grade(AttemptRow at) {
        List<OrderItem> order = parseOrder(at.questionOrder());
        Map<Long, QuestionRow> questions = questions(order);
        Map<Long, Set<Long>> correct = new HashMap<>();
        if (!order.isEmpty()) {
            db.sql("SELECT question_id, id FROM dbo.question_options WHERE question_id IN (:ids) AND is_active = 1 AND is_correct = 1")
                    .param("ids", order.stream().map(OrderItem::q).toList())
                    .query((rs, i) -> correct.computeIfAbsent(rs.getLong(1), k -> new HashSet<>()).add(rs.getLong(2))).list();
        }
        Map<Long, List<Long>> saved = savedAnswers(at.id());
        BigDecimal score = BigDecimal.ZERO;
        BigDecimal max = BigDecimal.ZERO;
        int correctCount = 0;
        for (OrderItem o : order) {
            QuestionRow qr = questions.get(o.q());
            if (qr == null) {
                continue;
            }
            max = max.add(qr.points());
            Set<Long> chosen = new HashSet<>(saved.getOrDefault(o.q(), List.of()));
            boolean ok = !chosen.isEmpty() && chosen.equals(correct.getOrDefault(o.q(), Set.of()));
            if (ok) {
                score = score.add(qr.points());
                correctCount++;
            }
            db.sql("UPDATE dbo.quiz_attempt_answers SET is_correct = :ok, points_awarded = :p WHERE attempt_id = :a AND question_id = :q")
                    .param("ok", ok).param("p", ok ? qr.points() : BigDecimal.ZERO).param("a", at.id()).param("q", o.q()).update();
        }
        BigDecimal percent = max.signum() == 0 ? BigDecimal.ZERO
                : score.multiply(BigDecimal.valueOf(100)).divide(max, 2, RoundingMode.HALF_UP);
        return new Grade(score, max, percent, correctCount, order.size());
    }

    private Graded finalizeAttempt(AttemptRow at, QuizRow q, String status) {
        Grade g = grade(at);
        boolean passed = g.percent().compareTo(BigDecimal.valueOf(q.passScorePercent())) >= 0;
        // BR-LRN-05: thời gian theo đồng hồ máy chủ; lượt hết giờ tính tới thời điểm hết giờ.
        Instant submittedAt = Instant.now();
        if ("EXPIRED".equals(status) && q.timeLimitSeconds() != null) {
            Instant limitAt = at.startedAt().plusSeconds(q.timeLimitSeconds());
            if (limitAt.isBefore(submittedAt)) {
                submittedAt = limitAt;
            }
        }
        int duration = (int) Math.max(0, Duration.between(at.startedAt(), submittedAt).toSeconds());
        if (q.timeLimitSeconds() != null) {
            duration = Math.min(duration, q.timeLimitSeconds());
        }
        Instant courseEnd = db.sql("SELECT end_date FROM dbo.courses WHERE id = :c").param("c", q.courseId())
                .query(Instant.class).optional().orElse(null);
        boolean counts = courseEnd == null || !submittedAt.isAfter(courseEnd); // BR-LRN-07
        db.sql("""
                UPDATE dbo.quiz_attempts SET status = :st, submitted_at = :at, duration_seconds = :dur, score = :score,
                    max_score = :max, score_percent = :pct, passed = :passed, counts_for_ranking = :counts
                WHERE id = :id""")
                .param("st", status).param("at", Db.ts(submittedAt)).param("dur", duration).param("score", g.score())
                .param("max", g.maxScore()).param("pct", g.percent()).param("passed", passed).param("counts", counts)
                .param("id", at.id()).update();

        boolean lessonCompleted = passed && progress.completeLesson(at.enrollmentId(), q.lessonId(), "QUIZ_PASSED");
        ProgressService.Progress p = progress.recompute(at.enrollmentId());
        if (counts) {
            ranking.onAttemptGraded(at.userId(), q.courseId(), q.id(), at.id(), g.score(), duration, submittedAt);
        }
        return new Graded(g.score(), g.maxScore(), g.percent(), passed, duration, g.correct(), g.total(),
                lessonCompleted, p.percent(), p.completed());
    }

    /** Tự nộp các lượt quá giờ (design-db 05 §8). Bỏ qua lượt mà thời hạn học đã hết: job hết hạn sẽ xóa. */
    @Scheduled(fixedDelayString = "PT1M", initialDelayString = "PT20S")
    public void autoSubmitExpired() {
        List<Long> ids = db.sql("""
                SELECT TOP (200) a.id FROM dbo.quiz_attempts a JOIN dbo.enrollments e ON e.id = a.enrollment_id
                WHERE a.status = N'IN_PROGRESS' AND a.expires_at < SYSUTCDATETIME()
                  AND (e.status = N'COMPLETED' OR e.expires_at > SYSUTCDATETIME())""").query(Long.class).list();
        for (Long id : ids) {
            try {
                tx.executeWithoutResult(s -> {
                    AttemptRow at = db.sql("""
                            SELECT id, quiz_id, user_id, enrollment_id, attempt_no, status, question_order, started_at, expires_at,
                                   submitted_at, duration_seconds, score, max_score, score_percent, passed
                            FROM dbo.quiz_attempts WITH (UPDLOCK) WHERE id = :id AND status = N'IN_PROGRESS'""")
                            .param("id", id).query(AttemptRow.class).optional().orElse(null);
                    if (at != null) {
                        finalizeAttempt(at, quiz(at.quizId()), "EXPIRED");
                    }
                });
            } catch (RuntimeException e) {
                log.error("Không tự nộp được lượt quiz {}", id, e);
            }
        }
    }

    /** FR-RNK-04: chấm lại mọi lượt đã nộp của khóa theo đáp án hiện tại (không đổi tiến độ). */
    public void regradeCourse(long courseId) {
        List<Long> ids = db.sql("""
                SELECT a.id FROM dbo.quiz_attempts a JOIN dbo.quizzes q ON q.id = a.quiz_id JOIN dbo.lessons l ON l.id = q.lesson_id
                WHERE l.course_id = :c AND a.status IN (N'SUBMITTED', N'EXPIRED')""").param("c", courseId)
                .query(Long.class).list();
        for (Long id : ids) {
            AttemptRow at = db.sql("""
                    SELECT id, quiz_id, user_id, enrollment_id, attempt_no, status, question_order, started_at, expires_at,
                           submitted_at, duration_seconds, score, max_score, score_percent, passed
                    FROM dbo.quiz_attempts WHERE id = :id""").param("id", id).query(AttemptRow.class).single();
            QuizRow q = quiz(at.quizId());
            Grade g = grade(at);
            boolean passed = g.percent().compareTo(BigDecimal.valueOf(q.passScorePercent())) >= 0;
            db.sql("UPDATE dbo.quiz_attempts SET score = :s, max_score = :m, score_percent = :p, passed = :ok WHERE id = :id")
                    .param("s", g.score()).param("m", g.maxScore()).param("p", g.percent()).param("ok", passed)
                    .param("id", id).update();
        }
    }

    // ---------------------------------------------------------------- kết quả & lịch sử

    public AttemptResult result(long attemptId, long userId) {
        AttemptRow at = attempt(attemptId, userId, false);
        if ("IN_PROGRESS".equals(at.status())) {
            throw ApiException.conflict("ATTEMPT_IN_PROGRESS", "Lượt làm bài chưa nộp");
        }
        QuizRow q = quiz(at.quizId());
        Access a = access.require(q.courseId(), userId);
        boolean show = q.showAnswersAfterSubmit();
        List<OrderItem> order = parseOrder(at.questionOrder());
        Map<Long, QuestionRow> questions = questions(order);
        record Opt(long id, long questionId, String content, boolean isCorrect) {
        }
        Map<Long, Opt> options = new HashMap<>();
        if (!order.isEmpty()) {
            db.sql("SELECT id, question_id, content, is_correct FROM dbo.question_options WHERE question_id IN (:ids)")
                    .param("ids", order.stream().map(OrderItem::q).toList()).query(Opt.class).list()
                    .forEach(o -> options.put(o.id(), o));
        }
        Map<Long, List<Long>> saved = savedAnswers(at.id());
        record Ans(long questionId, Boolean isCorrect, BigDecimal pointsAwarded) {
        }
        Map<Long, Ans> graded = new HashMap<>();
        db.sql("SELECT question_id, is_correct, points_awarded FROM dbo.quiz_attempt_answers WHERE attempt_id = :a")
                .param("a", at.id()).query(Ans.class).list().forEach(x -> graded.put(x.questionId(), x));
        List<ResultQuestion> rq = order.stream().filter(o -> questions.containsKey(o.q())).map(o -> {
            QuestionRow qr = questions.get(o.q());
            Set<Long> chosen = new HashSet<>(saved.getOrDefault(o.q(), List.of()));
            Ans ans = graded.get(o.q());
            return new ResultQuestion(qr.id(), qr.content(), qr.questionType(), qr.points(),
                    ans == null || ans.pointsAwarded() == null ? BigDecimal.ZERO : ans.pointsAwarded(),
                    ans != null && Boolean.TRUE.equals(ans.isCorrect()), show ? qr.explanation() : null,
                    o.o().stream().filter(options::containsKey).map(oid -> new ResultOption(oid, options.get(oid).content(),
                            chosen.contains(oid), show ? options.get(oid).isCorrect() : null)).toList());
        }).toList();
        boolean best = db.sql("SELECT COUNT(*) FROM dbo.quiz_best_attempts WHERE attempt_id = :a").param("a", at.id())
                .query(Integer.class).single() > 0;
        String lessonTitle = db.sql("SELECT title FROM dbo.lessons WHERE id = :l").param("l", q.lessonId())
                .query(String.class).single();
        ProgressService.Progress p = new ProgressService.Progress(db.sql("SELECT progress_percent FROM dbo.enrollments WHERE id = :e")
                .param("e", a.enrollmentId()).query(Integer.class).single(), false);
        LessonRef next = progress.nextUnlocked(q.courseId(), a.enrollmentId(), q.lessonId());
        return new AttemptResult(at.id(), q.id(), q.lessonId(), a.courseSlug(), lessonTitle, at.attemptNo(), at.status(),
                at.score(), at.maxScore(), at.scorePercent(), Boolean.TRUE.equals(at.passed()),
                at.durationSeconds() == null ? 0 : at.durationSeconds(), at.submittedAt(), q.passScorePercent(), show,
                best, rq, next, p.percent(), ranking.myRank(q.courseId(), userId).rank());
    }

    public List<AttemptHistoryItem> history(long quizId, long userId) {
        QuizRow q = quiz(quizId);
        Access a = access.require(q.courseId(), userId);
        Long bestId = db.sql("SELECT attempt_id FROM dbo.quiz_best_attempts WHERE user_id = :u AND quiz_id = :q")
                .param("u", userId).param("q", quizId).query(Long.class).optional().orElse(null);
        return db.sql("""
                SELECT id, attempt_no, status, started_at, submitted_at, score, max_score, score_percent, passed, duration_seconds
                FROM dbo.quiz_attempts WHERE quiz_id = :q AND enrollment_id = :e ORDER BY attempt_no DESC""")
                .param("q", quizId).param("e", a.enrollmentId())
                .query((rs, i) -> new AttemptHistoryItem(rs.getLong("id"), rs.getInt("attempt_no"), rs.getString("status"),
                        ts(rs, "started_at"), ts(rs, "submitted_at"), rs.getBigDecimal("score"), rs.getBigDecimal("max_score"),
                        rs.getBigDecimal("score_percent"), (Boolean) rs.getObject("passed", Boolean.class),
                        (Integer) rs.getObject("duration_seconds", Integer.class),
                        bestId != null && bestId == rs.getLong("id")))
                .list();
    }

    private static Instant ts(java.sql.ResultSet rs, String col) throws java.sql.SQLException {
        java.sql.Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }

    // ---------------------------------------------------------------- JSON

    private String toJson(List<OrderItem> order) {
        try {
            return json.writeValueAsString(order);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private List<OrderItem> parseOrder(String raw) {
        if (raw == null) {
            return List.of();
        }
        try {
            return json.readValue(raw, new TypeReference<List<OrderItem>>() {
            });
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
