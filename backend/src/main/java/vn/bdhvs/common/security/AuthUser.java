package vn.bdhvs.common.security;

import java.util.Collection;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/** Người dùng đã xác thực của request hiện tại. */
public record AuthUser(long id, String email, String fullName, List<String> roles) {

    public boolean isAdmin() {
        return roles.contains("ADMIN");
    }

    public Collection<? extends GrantedAuthority> authorities() {
        return roles.stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
    }
}
