package vn.bdhvs.auth;

import java.time.Duration;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import vn.bdhvs.auth.AuthDtos.ForgotPasswordRequest;
import vn.bdhvs.auth.AuthDtos.LoginRequest;
import vn.bdhvs.auth.AuthDtos.MessageResponse;
import vn.bdhvs.auth.AuthDtos.RegisterRequest;
import vn.bdhvs.auth.AuthDtos.RegisterResponse;
import vn.bdhvs.auth.AuthDtos.ResendOtpRequest;
import vn.bdhvs.auth.AuthDtos.ResetPasswordRequest;
import vn.bdhvs.auth.AuthDtos.ResetTokenResponse;
import vn.bdhvs.auth.AuthDtos.TokenResponse;
import vn.bdhvs.auth.AuthDtos.VerifyOtpRequest;
import vn.bdhvs.common.audit.AuditService;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.security.JwtService;
import vn.bdhvs.common.util.RateLimiter;

/** SRS 08 §2 — /api/v1/auth */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService auth;
    private final RefreshTokenService refreshTokens;
    private final JwtService jwt;
    private final RateLimiter rateLimiter;

    public AuthController(AuthService auth, RefreshTokenService refreshTokens, JwtService jwt, RateLimiter rateLimiter) {
        this.auth = auth;
        this.refreshTokens = refreshTokens;
        this.jwt = jwt;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest body, HttpServletRequest req) {
        auth.register(body, AuditService.clientIp(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(new RegisterResponse(body.email().trim().toLowerCase(),
                OtpService.TTL.toSeconds(), OtpService.RESEND_GAP.toSeconds()));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<TokenResponse> verifyOtp(@Valid @RequestBody VerifyOtpRequest body, HttpServletRequest req) {
        limit("verify", req, 10);
        long userId = auth.verifyRegistration(body.email(), body.code());
        return issueSession(userId, false, req);
    }

    @PostMapping("/resend-otp")
    public MessageResponse resendOtp(@Valid @RequestBody ResendOtpRequest body, HttpServletRequest req) {
        auth.resendOtp(body.email(), body.purpose(), AuditService.clientIp(req));
        return new MessageResponse("Nếu email tồn tại trong hệ thống, mã xác thực mới đã được gửi");
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest body, HttpServletRequest req) {
        limit("login", req, 10);
        long userId = auth.login(body.email(), body.password(), AuditService.clientIp(req));
        return issueSession(userId, body.rememberMe(), req);
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(@CookieValue(name = RefreshTokenService.COOKIE, required = false) String raw,
            HttpServletRequest req) {
        if (raw == null || raw.isBlank()) {
            throw ApiException.unauthorized("TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn");
        }
        RefreshTokenService.Rotated rotated = refreshTokens.rotate(raw, req.getHeader("User-Agent"), AuditService.clientIp(req));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokens.cookie(rotated.token()).toString())
                .body(new TokenResponse(jwt.issue(rotated.userId()), jwt.expiresInSeconds(), auth.summary(rotated.userId())));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = RefreshTokenService.COOKIE, required = false) String raw,
            @RequestParam(defaultValue = "false") boolean all) {
        if (raw != null && !raw.isBlank()) {
            if (all) {
                refreshTokens.activeUserId(raw).ifPresent(uid -> refreshTokens.revokeAll(uid, "LOGOUT_ALL"));
            } else {
                refreshTokens.revoke(raw, "LOGOUT");
            }
        }
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, refreshTokens.clearCookie().toString()).build();
    }

    @PostMapping("/forgot-password")
    public MessageResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest body, HttpServletRequest req) {
        auth.forgotPassword(body.email(), AuditService.clientIp(req));
        return new MessageResponse("Nếu email tồn tại trong hệ thống, mã xác thực đã được gửi");
    }

    @PostMapping("/forgot-password/verify")
    public ResetTokenResponse verifyForgot(@Valid @RequestBody VerifyOtpRequest body, HttpServletRequest req) {
        limit("verify", req, 10);
        return auth.verifyForgotPassword(body.email(), body.code());
    }

    @PostMapping("/reset-password")
    public MessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest body) {
        auth.resetPassword(body.resetToken(), body.newPassword());
        return new MessageResponse("Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại");
    }

    private ResponseEntity<TokenResponse> issueSession(long userId, boolean rememberMe, HttpServletRequest req) {
        RefreshTokenService.Issued token = refreshTokens.create(userId, rememberMe, req.getHeader("User-Agent"),
                AuditService.clientIp(req));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokens.cookie(token).toString())
                .body(new TokenResponse(jwt.issue(userId), jwt.expiresInSeconds(), auth.summary(userId)));
    }

    private void limit(String name, HttpServletRequest req, int perMinute) {
        rateLimiter.check(name + ":" + AuditService.clientIp(req), perMinute, Duration.ofMinutes(1));
    }
}
