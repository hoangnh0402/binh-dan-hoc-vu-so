package vn.bdhvs.admin;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import vn.bdhvs.common.util.Texts;

/** courses.search_text = normalize(title) + normalize(short_description) + normalize(tên tổ chức) (design-db 01 §5). */
@Service
public class SearchTextService {

    private final JdbcClient db;

    public SearchTextService(JdbcClient db) {
        this.db = db;
    }

    private record Row(long id, String title, String shortDescription, String orgName) {
    }

    public void refreshCourse(long courseId) {
        db.sql("""
                SELECT c.id, c.title, c.short_description, o.name AS org_name
                FROM dbo.courses c JOIN dbo.organizations o ON o.id = c.organization_id WHERE c.id = :id""")
                .param("id", courseId).query(Row.class).optional().ifPresent(this::write);
    }

    public void refreshOrganization(long organizationId) {
        db.sql("""
                SELECT c.id, c.title, c.short_description, o.name AS org_name
                FROM dbo.courses c JOIN dbo.organizations o ON o.id = c.organization_id WHERE o.id = :o""")
                .param("o", organizationId).query(Row.class).list().forEach(this::write);
    }

    private void write(Row r) {
        String text = String.join(" ", Texts.normalize(r.title()), Texts.normalize(r.shortDescription()),
                Texts.normalize(r.orgName())).trim();
        db.sql("UPDATE dbo.courses SET search_text = :t WHERE id = :id")
                .param("t", text.length() > 1000 ? text.substring(0, 1000) : text).param("id", r.id()).update();
    }
}
