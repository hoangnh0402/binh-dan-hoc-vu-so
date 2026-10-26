package vn.bdhvs.admin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import vn.bdhvs.common.audit.AuditService;
import vn.bdhvs.common.error.ApiException;
import vn.bdhvs.common.util.Texts;

/** Loại khóa học 2 cấp (FR-ADM-07..10, BR-ADM-02..05) và tổ chức đào tạo (FR-ADM-11). */
@Service
public class AdminTaxonomyService {

    private final JdbcClient db;
    private final AuditService audit;
    private final SearchTextService searchText;

    public AdminTaxonomyService(JdbcClient db, AuditService audit, SearchTextService searchText) {
        this.db = db;
        this.audit = audit;
        this.searchText = searchText;
    }

    // ============================================================ loại khóa học

    public record CategoryAdmin(long id, Long parentId, int depth, String name, String slug, String description,
            String iconUrl, int sortOrder, boolean isActive, int courseCount, List<CategoryAdmin> children) {
    }

    public record CategoryRequest(Long parentId, @NotBlank(message = "Vui lòng nhập tên") @Size(max = 150) String name,
            @Size(max = 170) String slug, @Size(max = 1000) String description, @Size(max = 500) String iconUrl,
            Integer sortOrder, Boolean isActive) {
    }

    public record SortItem(@NotNull Long id, @NotNull Integer sortOrder) {
    }

    public List<CategoryAdmin> categories() {
        record Row(long id, Long parentId, int depth, String name, String slug, String description, String iconUrl,
                int sortOrder, boolean isActive, int courseCount) {
        }
        List<Row> rows = db.sql("""
                SELECT cc.id, cc.parent_id, cc.depth, cc.name, cc.slug, cc.description, cc.icon_url, cc.sort_order, cc.is_active,
                       (SELECT COUNT(*) FROM dbo.courses c JOIN dbo.course_categories k ON k.id = c.category_id
                        WHERE k.id = cc.id OR k.parent_id = cc.id) AS course_count
                FROM dbo.course_categories cc ORDER BY cc.depth, cc.sort_order, cc.name""").query(Row.class).list();
        Map<Long, List<CategoryAdmin>> children = new HashMap<>();
        rows.stream().filter(r -> r.parentId() != null).forEach(r -> children.computeIfAbsent(r.parentId(), k -> new ArrayList<>())
                .add(new CategoryAdmin(r.id(), r.parentId(), r.depth(), r.name(), r.slug(), r.description(), r.iconUrl(),
                        r.sortOrder(), r.isActive(), r.courseCount(), List.of())));
        return rows.stream().filter(r -> r.parentId() == null)
                .map(r -> new CategoryAdmin(r.id(), null, 1, r.name(), r.slug(), r.description(), r.iconUrl(), r.sortOrder(),
                        r.isActive(), r.courseCount(), children.getOrDefault(r.id(), List.of())))
                .toList();
    }

    @Transactional
    public long createCategory(CategoryRequest r, long actorId) {
        checkParent(r.parentId(), null);
        String slug = uniqueSlug("course_categories", r.slug() == null || r.slug().isBlank() ? r.name() : r.slug(), null);
        checkNameFree(r.parentId(), r.name().trim(), null);
        int sort = r.sortOrder() != null ? r.sortOrder()
                : db.sql("SELECT ISNULL(MAX(sort_order), 0) + 1 FROM dbo.course_categories WHERE " +
                        (r.parentId() == null ? "parent_id IS NULL" : "parent_id = :p"))
                        .params(r.parentId() == null ? Map.of() : Map.of("p", r.parentId())).query(Integer.class).single();
        long id = db.sql("""
                INSERT INTO dbo.course_categories (parent_id, depth, parent_depth, name, slug, description, icon_url, sort_order, is_active)
                OUTPUT INSERTED.id VALUES (:p, :d, :pd, :name, :slug, :desc, :icon, :sort, :active)""")
                .param("p", r.parentId()).param("d", r.parentId() == null ? 1 : 2).param("pd", r.parentId() == null ? null : 1)
                .param("name", r.name().trim()).param("slug", slug).param("desc", Texts.trimToNull(r.description()))
                .param("icon", Texts.trimToNull(r.iconUrl())).param("sort", sort)
                .param("active", r.isActive() == null || r.isActive()).query(Long.class).single();
        audit.log(actorId, "CREATE", "COURSE_CATEGORY", id, null, r);
        return id;
    }

    @Transactional
    public void updateCategory(long id, CategoryRequest r, long actorId) {
        record Cur(Long parentId, int children, int courses) {
        }
        Cur cur = db.sql("""
                SELECT parent_id, (SELECT COUNT(*) FROM dbo.course_categories c WHERE c.parent_id = cc.id) AS children,
                       (SELECT COUNT(*) FROM dbo.courses c WHERE c.category_id = cc.id) AS courses
                FROM dbo.course_categories cc WHERE id = :id""").param("id", id).query(Cur.class).optional()
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy loại khóa học"));
        boolean levelChange = (cur.parentId() == null) != (r.parentId() == null);
        if (levelChange && cur.children() > 0) {
            throw ApiException.conflict("CATEGORY_HAS_CHILDREN", "Không thể chuyển lĩnh vực cấp 1 đang có loại con thành cấp 2");
        }
        if (levelChange && cur.courses() > 0) {
            throw ApiException.conflict("CATEGORY_HAS_COURSES", "Không thể chuyển loại cấp 2 đang có khóa học thành cấp 1");
        }
        checkParent(r.parentId(), id);
        checkNameFree(r.parentId(), r.name().trim(), id);
        String slug = uniqueSlug("course_categories", r.slug() == null || r.slug().isBlank() ? r.name() : r.slug(), id);
        db.sql("""
                UPDATE dbo.course_categories SET parent_id = :p, depth = :d, parent_depth = :pd, name = :name, slug = :slug,
                    description = :desc, icon_url = :icon, sort_order = COALESCE(:sort, sort_order),
                    is_active = COALESCE(:active, is_active), updated_at = SYSUTCDATETIME(), version = version + 1
                WHERE id = :id""")
                .param("p", r.parentId()).param("d", r.parentId() == null ? 1 : 2).param("pd", r.parentId() == null ? null : 1)
                .param("name", r.name().trim()).param("slug", slug).param("desc", Texts.trimToNull(r.description()))
                .param("icon", Texts.trimToNull(r.iconUrl())).param("sort", r.sortOrder()).param("active", r.isActive())
                .param("id", id).update();
        audit.log(actorId, "UPDATE", "COURSE_CATEGORY", id, null, r);
    }

    /** BR-ADM-04. */
    @Transactional
    public void deleteCategory(long id, long actorId) {
        int children = db.sql("SELECT COUNT(*) FROM dbo.course_categories WHERE parent_id = :id").param("id", id).query(Integer.class).single();
        if (children > 0) {
            throw ApiException.conflict("CATEGORY_HAS_CHILDREN", "Không thể xóa: lĩnh vực này còn " + children + " loại con");
        }
        int courses = db.sql("SELECT COUNT(*) FROM dbo.courses WHERE category_id = :id").param("id", id).query(Integer.class).single();
        if (courses > 0) {
            throw ApiException.conflict("CATEGORY_HAS_COURSES",
                    "Không thể xóa: loại này đang có " + courses + " khóa học. Hãy chuyển các khóa học sang loại khác trước");
        }
        if (db.sql("DELETE FROM dbo.course_categories WHERE id = :id").param("id", id).update() == 0) {
            throw ApiException.notFound("Không tìm thấy loại khóa học");
        }
        audit.log(actorId, "DELETE", "COURSE_CATEGORY", id, null, null);
    }

    @Transactional
    public void reorderCategories(List<SortItem> items, long actorId) {
        for (SortItem it : items) {
            db.sql("UPDATE dbo.course_categories SET sort_order = :s, updated_at = SYSUTCDATETIME() WHERE id = :id")
                    .param("s", it.sortOrder()).param("id", it.id()).update();
        }
        audit.log(actorId, "UPDATE", "COURSE_CATEGORY", null, null, Map.of("reorder", items));
    }

    private void checkParent(Long parentId, Long selfId) {
        if (parentId == null) {
            return;
        }
        if (parentId.equals(selfId)) {
            throw ApiException.validation("parentId", "Loại cha không hợp lệ");
        }
        Integer depth = db.sql("SELECT depth FROM dbo.course_categories WHERE id = :id").param("id", parentId)
                .query(Integer.class).optional().orElseThrow(() -> ApiException.validation("parentId", "Không tìm thấy loại cha"));
        if (depth != 1) {
            throw ApiException.validation("parentId", "Chỉ hỗ trợ tối đa 2 cấp: loại cha phải là lĩnh vực cấp 1");
        }
    }

    private void checkNameFree(Long parentId, String name, Long selfId) {
        int n = db.sql("SELECT COUNT(*) FROM dbo.course_categories WHERE " + (parentId == null ? "parent_id IS NULL" : "parent_id = :p")
                + " AND name = :n AND id <> :id")
                .params(parentId == null ? Map.of("n", name, "id", selfId == null ? -1L : selfId)
                        : Map.of("p", parentId, "n", name, "id", selfId == null ? -1L : selfId))
                .query(Integer.class).single();
        if (n > 0) {
            throw ApiException.validation("name", "Tên này đã tồn tại trong cùng cấp cha");
        }
    }

    String uniqueSlug(String table, String source, Long selfId) {
        String base = Texts.slugify(source);
        if (base.isEmpty()) {
            base = "muc";
        }
        String slug = base;
        for (int i = 2; ; i++) {
            int n = db.sql("SELECT COUNT(*) FROM dbo." + table + " WHERE slug = :s AND id <> :id")
                    .param("s", slug).param("id", selfId == null ? -1L : selfId).query(Integer.class).single();
            if (n == 0) {
                return slug;
            }
            slug = base + "-" + i;
        }
    }

    // ============================================================ tổ chức đào tạo

    public record OrganizationAdmin(long id, String name, String slug, String logoUrl, String website,
            String contactEmail, String description, boolean isActive, int courseCount) {
    }

    public record OrganizationRequest(@NotBlank(message = "Vui lòng nhập tên") @Size(max = 200) String name,
            @Size(max = 220) String slug, @Size(max = 500) String logoUrl, @Size(max = 500) String website,
            @Email @Size(max = 255) String contactEmail, String description, Boolean isActive) {
    }

    public List<OrganizationAdmin> organizations(String q) {
        return db.sql("""
                SELECT o.id, o.name, o.slug, o.logo_url, o.website, o.contact_email, o.description, o.is_active,
                       (SELECT COUNT(*) FROM dbo.courses c WHERE c.organization_id = o.id) AS course_count
                FROM dbo.organizations o WHERE (:q = N'' OR o.name LIKE N'%' + :q + N'%') ORDER BY o.is_active DESC, o.name""")
                .param("q", q == null ? "" : q.trim()).query(OrganizationAdmin.class).list();
    }

    @Transactional
    public long createOrganization(OrganizationRequest r, long actorId) {
        checkOrgName(r.name().trim(), null);
        long id = db.sql("""
                INSERT INTO dbo.organizations (name, slug, logo_url, website, contact_email, description, is_active)
                OUTPUT INSERTED.id VALUES (:n, :s, :logo, :web, :mail, :d, :a)""")
                .param("n", r.name().trim())
                .param("s", uniqueSlug("organizations", r.slug() == null || r.slug().isBlank() ? r.name() : r.slug(), null))
                .param("logo", Texts.trimToNull(r.logoUrl())).param("web", Texts.trimToNull(r.website()))
                .param("mail", Texts.trimToNull(r.contactEmail())).param("d", Texts.trimToNull(r.description()))
                .param("a", r.isActive() == null || r.isActive()).query(Long.class).single();
        audit.log(actorId, "CREATE", "ORGANIZATION", id, null, r);
        return id;
    }

    @Transactional
    public void updateOrganization(long id, OrganizationRequest r, long actorId) {
        checkOrgName(r.name().trim(), id);
        int n = db.sql("""
                UPDATE dbo.organizations SET name = :n, slug = :s, logo_url = :logo, website = :web, contact_email = :mail,
                    description = :d, is_active = COALESCE(:a, is_active), updated_at = SYSUTCDATETIME(), version = version + 1
                WHERE id = :id""")
                .param("n", r.name().trim())
                .param("s", uniqueSlug("organizations", r.slug() == null || r.slug().isBlank() ? r.name() : r.slug(), id))
                .param("logo", Texts.trimToNull(r.logoUrl())).param("web", Texts.trimToNull(r.website()))
                .param("mail", Texts.trimToNull(r.contactEmail())).param("d", Texts.trimToNull(r.description()))
                .param("a", r.isActive()).param("id", id).update();
        if (n == 0) {
            throw ApiException.notFound("Không tìm thấy tổ chức");
        }
        searchText.refreshOrganization(id);
        audit.log(actorId, "UPDATE", "ORGANIZATION", id, null, r);
    }

    @Transactional
    public void deleteOrganization(long id, long actorId) {
        int courses = db.sql("SELECT COUNT(*) FROM dbo.courses WHERE organization_id = :id").param("id", id).query(Integer.class).single();
        if (courses > 0) {
            throw ApiException.conflict("ORGANIZATION_HAS_COURSES",
                    "Tổ chức đang có " + courses + " khóa học nên không xóa được, chỉ có thể tắt hoạt động");
        }
        if (db.sql("DELETE FROM dbo.organizations WHERE id = :id").param("id", id).update() == 0) {
            throw ApiException.notFound("Không tìm thấy tổ chức");
        }
        audit.log(actorId, "DELETE", "ORGANIZATION", id, null, null);
    }

    private void checkOrgName(String name, Long selfId) {
        int n = db.sql("SELECT COUNT(*) FROM dbo.organizations WHERE name = :n AND id <> :id")
                .param("n", name).param("id", selfId == null ? -1L : selfId).query(Integer.class).single();
        if (n > 0) {
            throw ApiException.validation("name", "Tên tổ chức đã tồn tại");
        }
    }
}
