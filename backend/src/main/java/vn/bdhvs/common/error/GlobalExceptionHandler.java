package vn.bdhvs.common.error;

import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    public record ErrorBody(int status, String code, String message, List<ApiException.FieldError> errors, String traceId) {
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorBody> api(ApiException ex) {
        return body(ex.status(), ex.code(), ex.getMessage(), ex.errors());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorBody> invalid(MethodArgumentNotValidException ex) {
        List<ApiException.FieldError> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> new ApiException.FieldError(e.getField(), e.getDefaultMessage()))
                .toList();
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", errors);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ErrorBody> unreadable(Exception ex) {
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dữ liệu gửi lên không đúng định dạng", List.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ErrorBody> denied(AccessDeniedException ex) {
        return body(HttpStatus.FORBIDDEN, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này", List.of());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ErrorBody> tooLarge(MaxUploadSizeExceededException ex) {
        return body(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "Tệp vượt quá dung lượng cho phép", List.of());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ErrorBody> noResource(NoResourceFoundException ex) {
        return body(HttpStatus.NOT_FOUND, "NOT_FOUND", "Không tìm thấy", List.of());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErrorBody> integrity(DataIntegrityViolationException ex) {
        log.warn("Vi phạm ràng buộc dữ liệu: {}", ex.getMostSpecificCause().getMessage());
        return body(HttpStatus.CONFLICT, "CONFLICT", "Dữ liệu bị trùng hoặc đang được sử dụng", List.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorBody> unexpected(Exception ex) {
        String traceId = UUID.randomUUID().toString().substring(0, 8);
        log.error("Lỗi không mong đợi traceId={}", traceId, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ErrorBody(500, "INTERNAL_ERROR",
                "Hệ thống đang gặp sự cố, vui lòng thử lại sau", List.of(), traceId));
    }

    private ResponseEntity<ErrorBody> body(HttpStatus status, String code, String message,
            List<ApiException.FieldError> errors) {
        String traceId = UUID.randomUUID().toString().substring(0, 8);
        return ResponseEntity.status(status)
                .body(new ErrorBody(status.value(), code, message, errors.isEmpty() ? null : errors, traceId));
    }
}
