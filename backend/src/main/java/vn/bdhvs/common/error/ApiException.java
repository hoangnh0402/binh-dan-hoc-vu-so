package vn.bdhvs.common.error;

import java.util.List;

import org.springframework.http.HttpStatus;

/** Lỗi nghiệp vụ trả về client theo định dạng SRS 08 §1.3. */
public class ApiException extends RuntimeException {

    public record FieldError(String field, String message) {
    }

    private final HttpStatus status;
    private final String code;
    private final List<FieldError> errors;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    public ApiException(HttpStatus status, String code, String message, List<FieldError> errors) {
        super(message);
        this.status = status;
        this.code = code;
        this.errors = errors;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public List<FieldError> errors() {
        return errors;
    }

    public static ApiException badRequest(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    public static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dữ liệu không hợp lệ",
                List.of(new FieldError(field, message)));
    }

    public static ApiException unauthorized(String code, String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, code, message);
    }

    public static ApiException forbidden(String code, String message) {
        return new ApiException(HttpStatus.FORBIDDEN, code, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }

    public static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }

    public static ApiException unprocessable(String code, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }

    public static ApiException tooMany(String code, String message) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, code, message);
    }
}
