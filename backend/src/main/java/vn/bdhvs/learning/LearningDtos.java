package vn.bdhvs.learning;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import vn.bdhvs.catalog.CatalogDtos.LessonItem;
import vn.bdhvs.catalog.CatalogDtos.MyEnrollment;

public final class LearningDtos {

    private LearningDtos() {
    }

    public record CourseOverview(long courseId, String slug, String title, int learningDurationDays,
            String timeStatus, MyEnrollment enrollment, List<LessonItem> lessons, Long lastLessonId) {
    }

    public record Attachment(long id, String name, String url, String contentType, long sizeBytes) {
    }

    public record QuizInfo(long id, String title, int questionCount, Integer timeLimitSeconds, int passScorePercent,
            Integer maxAttempts, int usedAttempts, int retryCooldownSeconds, Instant nextAttemptAt,
            Long inProgressAttemptId, BigDecimal bestScorePercent, boolean passed) {
    }

    public record LessonContent(long id, long courseId, String courseSlug, String courseTitle, int orderIndex,
            int lessonCount, String title, String content, String videoUrl, String assignment,
            Integer estimatedMinutes, String state, Instant startedAt, List<Attachment> attachments, QuizInfo quiz,
            Long previousLessonId, Long nextLessonId, Instant enrollmentExpiresAt) {
    }

    public record CompleteResult(boolean lessonCompleted, LessonRef nextLessonUnlocked, int courseProgressPercent,
            boolean courseCompleted) {
    }

    public record LessonRef(long id, String title) {
    }

    // -------- quiz --------

    public record OptionView(long id, String content) {
    }

    public record QuestionView(long id, String content, String type, BigDecimal points, List<OptionView> options) {
    }

    public record AttemptView(long attemptId, long quizId, long lessonId, String courseSlug, String quizTitle,
            int attemptNo, String status, Instant startedAt, Instant expiresAt, Instant enrollmentExpiresAt,
            int passScorePercent, List<QuestionView> questions, List<AnswerInput> savedAnswers) {
    }

    public record AnswerInput(@NotNull Long questionId, List<Long> selectedOptionIds) {
    }

    public record AnswersRequest(@Valid List<AnswerInput> answers) {
    }

    public record RankingInfo(Integer rank, BigDecimal totalScore, int totalDurationSeconds) {
    }

    public record SubmitResult(long attemptId, BigDecimal score, BigDecimal maxScore, BigDecimal scorePercent,
            boolean passed, int durationSeconds, int correctCount, int questionCount, boolean lessonCompleted,
            LessonRef nextLessonUnlocked, int courseProgressPercent, boolean courseCompleted, RankingInfo ranking) {
    }

    public record ResultOption(long id, String content, boolean selected, Boolean correct) {
    }

    public record ResultQuestion(long id, String content, String type, BigDecimal points, BigDecimal pointsAwarded,
            boolean isCorrect, String explanation, List<ResultOption> options) {
    }

    public record AttemptResult(long attemptId, long quizId, long lessonId, String courseSlug, String lessonTitle,
            int attemptNo, String status, BigDecimal score, BigDecimal maxScore, BigDecimal scorePercent,
            boolean passed, int durationSeconds, Instant submittedAt, int passScorePercent, boolean showAnswers,
            boolean isBest, List<ResultQuestion> questions, LessonRef nextLesson, int courseProgressPercent,
            Integer rank) {
    }

    public record AttemptHistoryItem(long id, int attemptNo, String status, Instant startedAt, Instant submittedAt,
            BigDecimal score, BigDecimal maxScore, BigDecimal scorePercent, Boolean passed, Integer durationSeconds,
            boolean best) {
    }
}
