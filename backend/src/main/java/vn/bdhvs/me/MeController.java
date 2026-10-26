package vn.bdhvs.me;

import java.time.Instant;
import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import vn.bdhvs.auth.PasswordPolicy;
import vn.bdhvs.auth.RefreshTokenService;
import vn.bdhvs.catalog.CatalogDtos.CourseCard;
import vn.bdhvs.catalog.CatalogService;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.mail.MailService;
import vn.bdhvs.common.security.AuthUser;
import vn.bdhvs.common.security.CurrentUser;
import vn.bdhvs.common.util.Texts;
import vn.bdhvs.common.web.PageResponse;
import vn.bdhvs.files.FileStorageService;

/** SRS 08 §3 — /api/v1/me: hồ sơ (FR-AUTH-09), đổi mật khẩu (FR-AUTH-08), khóa học của tôi (SCR-CRS-04). */
@RestController
@RequestMapping("/api/v1/me")
public class MeController {

    private final JdbcClient db;
    private final PasswordEncoder encoder;
    private final RefreshTokenService refreshTokens;
    private final MailService mail;
    private final FileStorageService files;
    private final CatalogService catalog;

    public MeController(JdbcClient db, PasswordEncoder encoder, RefreshTokenService refreshTokens, MailService mail,
            FileStorageService files, CatalogService catalog) {
        this.db = db;
        this.encoder = encoder;
        this.refreshTokens = refreshTokens;
        this.mail = mail;
        this.files = files;
        this.catalog = catalog;
    }

    public record Profile(long id, String email, String fullName, Integer birthYear, String hometown, String workplace,
            String phone, String avatarUrl, boolean showOnLeaderboard, Instant emailVerifiedAt, Instant createdAt,
            List<String> roles) {
    }

    public record UpdateProfile(
            @NotBlank(message = "Vui lòng nhập họ và tên") @Size(min = 2, max = 100) String fullName,
            @Min(1900) @Max(2100) Integer birthYear,
            @Size(max = 255) String hometown,
            @Size(max = 255) String workplace,
            @Pattern(regexp = "^$|^(0|\\+84)[0-9]{9,10}$", message = "Số điện thoại không đúng định dạng") String phone,
            Boolean showOnLeaderboard) {
    }

    public record ChangePassword(@NotBlank String currentPassword, @NotBlank String newPassword,
            @NotBlank String confirmPassword) {
    }

    @GetMapping
    public Profile me() {
        long id = CurrentUser.id();
        record Row(long id, String email, String fullName, Integer birthYear, String hometown, String workplace,
                String phone, String avatarUrl, boolean showOnLeaderboard, Instant emailVerifiedAt, Instant createdAt) {
        }
        Row r = db.sql("""
                SELECT id, email, full_name, birth_year, hometown, workplace, phone, avatar_url, show_on_leaderboard,
                       email_verified_at, created_at FROM dbo.users WHERE id = :id""").param("id", id).query(Row.class).single();
        return new Profile(r.id(), r.email(), r.fullName(), r.birthYear(), r.hometown(), r.workplace(), r.phone(),
                r.avatarUrl(), r.showOnLeaderboard(), r.emailVerifiedAt(), r.createdAt(), CurrentUser.require().roles());
    }

    @PutMapping
    public Profile update(@Valid @RequestBody UpdateProfile body) {
        if (body.birthYear() != null && body.birthYear() > java.time.Year.now().getValue()) {
            throw ApiException.validation("birthYear", "Năm sinh không hợp lệ");
        }
        db.sql("""
                UPDATE dbo.users SET full_name = :name, birth_year = :by, hometown = :ht, workplace = :wp, phone = :phone,
                    show_on_leaderboard = COALESCE(:show, show_on_leaderboard), updated_at = SYSUTCDATETIME()
                WHERE id = :id""")
                .param("name", body.fullName().trim()).param("by", body.birthYear())
                .param("ht", Texts.trimToNull(body.hometown())).param("wp", Texts.trimToNull(body.workplace()))
                .param("phone", Texts.trimToNull(body.phone())).param("show", body.showOnLeaderboard())
                .param("id", CurrentUser.id()).update();
        return me();
    }

    @PutMapping("/password")
    @Transactional
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePassword body,
            @CookieValue(name = RefreshTokenService.COOKIE, required = false) String currentRefresh) {
        AuthUser u = CurrentUser.require();
        String hash = db.sql("SELECT password_hash FROM dbo.users WHERE id = :id").param("id", u.id()).query(String.class).single();
        if (!encoder.matches(body.currentPassword(), hash)) {
            throw ApiException.validation("currentPassword", "Mật khẩu hiện tại không đúng");
        }
        if (!body.newPassword().equals(body.confirmPassword())) {
            throw ApiException.validation("confirmPassword", "Mật khẩu xác nhận không khớp");
        }
        if (body.newPassword().equals(body.currentPassword())) {
            throw ApiException.validation("newPassword", "Mật khẩu mới phải khác mật khẩu hiện tại");
        }
        PasswordPolicy.check("newPassword", body.newPassword(), u.email());
        db.sql("UPDATE dbo.users SET password_hash = :pw, updated_at = SYSUTCDATETIME() WHERE id = :id")
                .param("pw", encoder.encode(body.newPassword())).param("id", u.id()).update();
        refreshTokens.revokeOthers(u.id(), currentRefresh, "PASSWORD_CHANGED");
        mail.sendPasswordChanged(u.email(), u.fullName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/avatar")
    public Profile avatar(@RequestPart("file") MultipartFile file) {
        long id = CurrentUser.id();
        FileStorageService.Stored stored = files.store(file, "AVATAR", id);
        db.sql("UPDATE dbo.users SET avatar_url = :url, updated_at = SYSUTCDATETIME() WHERE id = :id")
                .param("url", stored.url()).param("id", id).update();
        return me();
    }

    /** SCR-CRS-04: khóa học của tôi, lọc theo trạng thái học. */
    @GetMapping("/enrollments")
    public PageResponse<CourseCard> enrollments(@RequestParam(required = false) List<String> status,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        List<String> mine = status == null || status.isEmpty() ? List.of("IN_PROGRESS", "COMPLETED", "EXPIRED") : status;
        int[] p = PageResponse.clamp(page, size, 24, 50);
        return catalog.myCourses(CurrentUser.id(), mine, p[0], p[1]);
    }

    @PostMapping("/logout-all")
    public ResponseEntity<Void> logoutAll() {
        refreshTokens.revokeAll(CurrentUser.id(), "LOGOUT_ALL");
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshTokens.clearCookie().toString()).build();
    }
}
