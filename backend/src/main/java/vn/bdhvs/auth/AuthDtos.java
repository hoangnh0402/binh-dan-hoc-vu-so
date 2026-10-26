package vn.bdhvs.auth;

import java.util.List;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank(message = "Vui lòng nhập họ và tên") @Size(min = 2, max = 100, message = "Họ tên dài từ 2 đến 100 ký tự") String fullName,
            @NotBlank(message = "Vui lòng nhập email") @Email(message = "Email không đúng định dạng") @Size(max = 255) String email,
            @NotBlank(message = "Vui lòng nhập mật khẩu") String password,
            @NotBlank(message = "Vui lòng nhập lại mật khẩu") String confirmPassword,
            @Min(value = 1900, message = "Năm sinh không hợp lệ") @Max(value = 2100, message = "Năm sinh không hợp lệ") Integer birthYear,
            @Size(max = 255) String hometown,
            @Size(max = 255) String workplace,
            @Pattern(regexp = "^$|^(0|\\+84)[0-9]{9,10}$", message = "Số điện thoại không đúng định dạng") String phone,
            @AssertTrue(message = "Bạn cần đồng ý với điều khoản và chính sách dữ liệu cá nhân") boolean privacyConsent) {
    }

    public record RegisterResponse(String email, long otpExpiresInSeconds, long resendAfterSeconds) {
    }

    public record VerifyOtpRequest(@NotBlank @Email String email,
            @NotBlank @Pattern(regexp = "\\d{6}", message = "Mã OTP gồm 6 chữ số") String code) {
    }

    public record ResendOtpRequest(@NotBlank @Email String email,
            @NotBlank @Pattern(regexp = "REGISTER|RESET_PASSWORD") String purpose) {
    }

    public record LoginRequest(@NotBlank(message = "Vui lòng nhập email") String email,
            @NotBlank(message = "Vui lòng nhập mật khẩu") String password,
            boolean rememberMe) {
    }

    public record ForgotPasswordRequest(@NotBlank @Email String email) {
    }

    public record ResetTokenResponse(String resetToken, long expiresInSeconds) {
    }

    public record ResetPasswordRequest(@NotBlank String resetToken, @NotBlank String newPassword) {
    }

    public record UserSummary(long id, String fullName, String email, String avatarUrl, List<String> roles) {
    }

    public record TokenResponse(String accessToken, long expiresIn, UserSummary user) {
    }

    public record MessageResponse(String message) {
    }
}
