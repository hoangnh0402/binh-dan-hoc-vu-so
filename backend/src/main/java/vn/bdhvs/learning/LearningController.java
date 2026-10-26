package vn.bdhvs.learning;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import vn.bdhvs.common.security.CurrentUser;
import vn.bdhvs.learning.LearningDtos.AnswersRequest;
import vn.bdhvs.learning.LearningDtos.AttemptHistoryItem;
import vn.bdhvs.learning.LearningDtos.AttemptResult;
import vn.bdhvs.learning.LearningDtos.AttemptView;
import vn.bdhvs.learning.LearningDtos.CompleteResult;
import vn.bdhvs.learning.LearningDtos.CourseOverview;
import vn.bdhvs.learning.LearningDtos.LessonContent;
import vn.bdhvs.learning.LearningDtos.SubmitResult;

/** SRS 08 §5 — /api/v1/learning (USER đã ghi danh, còn hạn học). */
@RestController
@RequestMapping("/api/v1/learning")
public class LearningController {

    private final LearningService learning;
    private final QuizService quizzes;

    public LearningController(LearningService learning, QuizService quizzes) {
        this.learning = learning;
        this.quizzes = quizzes;
    }

    public record StartAttemptResponse(long attemptId) {
    }

    @GetMapping("/courses/{courseRef}")
    public CourseOverview overview(@PathVariable String courseRef) {
        return learning.overview(courseRef, CurrentUser.require());
    }

    @GetMapping("/lessons/{lessonId}")
    public LessonContent lesson(@PathVariable long lessonId) {
        return learning.lesson(lessonId, CurrentUser.require());
    }

    @PostMapping("/lessons/{lessonId}/complete")
    public CompleteResult complete(@PathVariable long lessonId) {
        return learning.complete(lessonId, CurrentUser.require());
    }

    @PostMapping("/quizzes/{quizId}/attempts")
    public ResponseEntity<StartAttemptResponse> start(@PathVariable long quizId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new StartAttemptResponse(quizzes.start(quizId, CurrentUser.id())));
    }

    @GetMapping("/quizzes/{quizId}/attempts")
    public List<AttemptHistoryItem> history(@PathVariable long quizId) {
        return quizzes.history(quizId, CurrentUser.id());
    }

    @GetMapping("/attempts/{attemptId}")
    public AttemptView attempt(@PathVariable long attemptId) {
        return quizzes.view(attemptId, CurrentUser.id());
    }

    @PutMapping("/attempts/{attemptId}/answers")
    public ResponseEntity<Void> save(@PathVariable long attemptId, @Valid @RequestBody AnswersRequest body) {
        quizzes.saveAnswers(attemptId, CurrentUser.id(), body.answers());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/attempts/{attemptId}/submit")
    public SubmitResult submit(@PathVariable long attemptId, @Valid @RequestBody AnswersRequest body) {
        return quizzes.submit(attemptId, CurrentUser.id(), body.answers());
    }

    @GetMapping("/attempts/{attemptId}/result")
    public AttemptResult result(@PathVariable long attemptId) {
        return quizzes.result(attemptId, CurrentUser.id());
    }
}
