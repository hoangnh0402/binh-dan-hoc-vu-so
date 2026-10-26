package vn.bdhvs.common.security;

import java.io.IOException;
import java.util.List;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Đọc "Authorization: Bearer". Trạng thái người dùng được kiểm tra lại trong DB ở mỗi request
 * để tài khoản bị khóa/xóa mất quyền ngay (FR-ADM-05), không phải chờ token hết hạn.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;
    private final JdbcClient db;

    public JwtAuthFilter(JwtService jwt, JdbcClient db) {
        this.jwt = jwt;
        this.db = db;
    }

    private record Row(long id, String email, String fullName, String status) {
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            Long userId = jwt.parse(header.substring(7));
            if (userId != null) {
                db.sql("SELECT id, email, full_name, status FROM dbo.users WHERE id = :id AND deleted_at IS NULL")
                        .param("id", userId)
                        .query(Row.class)
                        .optional()
                        .filter(u -> "ACTIVE".equals(u.status()))
                        .ifPresent(u -> {
                            List<String> roles = db.sql("""
                                    SELECT r.code FROM dbo.user_roles ur JOIN dbo.roles r ON r.id = ur.role_id
                                    WHERE ur.user_id = :id""").param("id", u.id()).query(String.class).list();
                            AuthUser principal = new AuthUser(u.id(), u.email(), u.fullName(), roles);
                            SecurityContextHolder.getContext().setAuthentication(
                                    new UsernamePasswordAuthenticationToken(principal, null, principal.authorities()));
                        });
            }
        }
        chain.doFilter(req, res);
    }
}
