package vn.bdhvs.common.security;

import java.util.Optional;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import vn.bdhvs.common.error.ApiException;

public final class CurrentUser {

    private CurrentUser() {
    }

    public static Optional<AuthUser> find() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthUser u) {
            return Optional.of(u);
        }
        return Optional.empty();
    }

    public static AuthUser require() {
        return find().orElseThrow(() -> ApiException.unauthorized("UNAUTHORIZED", "Vui lòng đăng nhập"));
    }

    public static long id() {
        return require().id();
    }
}
