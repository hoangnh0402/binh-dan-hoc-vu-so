package vn.bdhvs.common.util;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;

/** Làm sạch HTML nội dung do Admin nhập trước khi lưu (FR-LRN-02, NFR-SEC-03). */
public final class Html {

    private static final Safelist SAFELIST = Safelist.relaxed()
            .addTags("iframe", "figure", "figcaption", "hr", "mark")
            .addAttributes("iframe", "src", "width", "height", "allowfullscreen", "frameborder")
            .addAttributes(":all", "class")
            .addProtocols("iframe", "src", "https")
            .preserveRelativeLinks(true);

    private Html() {
    }

    public static String sanitize(String html) {
        if (html == null || html.isBlank()) {
            return null;
        }
        String clean = Jsoup.clean(html, "", SAFELIST, new Document.OutputSettings().prettyPrint(false));
        // Chỉ cho phép nhúng video từ YouTube/Vimeo.
        Document doc = Jsoup.parseBodyFragment(clean);
        doc.select("iframe").forEach(f -> {
            String src = f.attr("src");
            if (!(src.startsWith("https://www.youtube.com/") || src.startsWith("https://www.youtube-nocookie.com/")
                    || src.startsWith("https://player.vimeo.com/"))) {
                f.remove();
            }
        });
        doc.outputSettings().prettyPrint(false);
        return doc.body().html();
    }
}
