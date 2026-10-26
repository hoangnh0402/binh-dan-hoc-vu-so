package vn.bdhvs.common.audit;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;

/** Ghi nhật ký thao tác quản trị (FR-ADM-22). Giá trị trước/sau lưu dạng JSON. */
@Service
public class AuditService {

    private final JdbcClient db;
    private final ObjectMapper json;

    public AuditService(JdbcClient db, ObjectMapper json) {
        this.db = db;
        this.json = json;
    }

    public void log(Long actorId, String action, String entityType, Long entityId, Object before, Object after) {
        HttpServletRequest req = currentRequest();
        db.sql("""
                INSERT INTO dbo.audit_logs (actor_id, action_type, entity_type, entity_id, before_data, after_data, ip_address, user_agent)
                VALUES (:actor, :action, :type, :entityId, :before, :after, :ip, :ua)""")
                .param("actor", actorId)
                .param("action", action)
                .param("type", entityType)
                .param("entityId", entityId)
                .param("before", toJson(before))
                .param("after", toJson(after))
                .param("ip", req == null ? null : clientIp(req))
                .param("ua", req == null ? null : truncate(req.getHeader("User-Agent"), 500))
                .update();
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static HttpServletRequest currentRequest() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes a ? a.getRequest() : null;
    }

    public static String clientIp(HttpServletRequest req) {
        return truncate(req.getRemoteAddr(), 45);
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
