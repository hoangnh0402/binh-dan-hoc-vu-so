package vn.bdhvs.common.util;

import java.text.Normalizer;
import java.util.Locale;

/** Chuẩn hóa chuỗi tiếng Việt cho tìm kiếm không dấu và slug (design-db 01 §5). */
public final class Texts {

    private Texts() {
    }

    public static String normalize(String s) {
        if (s == null) {
            return "";
        }
        String n = Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D');
        return n.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    public static String slugify(String s) {
        String slug = normalize(s).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return slug.length() > 160 ? slug.substring(0, 160).replaceAll("-$", "") : slug;
    }

    /** Thoát ký tự đặc biệt của LIKE, dùng kèm {@code ESCAPE N'\'} (design-db 05 §1). */
    public static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").replace("[", "\\[");
    }

    public static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    public static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
