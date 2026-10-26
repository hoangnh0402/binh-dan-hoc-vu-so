package vn.bdhvs.files;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import vn.bdhvs.common.config.AppProperties;
import vn.bdhvs.common.error.ApiException;

/**
 * Lưu tệp tải lên (FR-ADM-23, NFR-SEC-09). Dev lưu đĩa cục bộ, phục vụ tại /files/**.
 * Production nên thay bằng S3/MinIO (SRS 01) mà không đổi API.
 */
@Service
public class FileStorageService {

    public record Stored(long id, String url, String originalName, String contentType, long sizeBytes) {
    }

    private enum Kind {
        IMAGE(2L * 1024 * 1024, Set.of("image/jpeg", "image/png", "image/webp")),
        DOCUMENT(20L * 1024 * 1024, Set.of("application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation")),
        VIDEO(200L * 1024 * 1024, Set.of("video/mp4"));

        final long maxBytes;
        final Set<String> types;

        Kind(long maxBytes, Set<String> types) {
            this.maxBytes = maxBytes;
            this.types = types;
        }
    }

    private static final Map<String, Set<Kind>> PURPOSES = Map.of(
            "AVATAR", Set.of(Kind.IMAGE),
            "COURSE_THUMBNAIL", Set.of(Kind.IMAGE),
            "CATEGORY_ICON", Set.of(Kind.IMAGE),
            "ORGANIZATION_LOGO", Set.of(Kind.IMAGE),
            "QUESTION_IMAGE", Set.of(Kind.IMAGE),
            "LESSON_CONTENT", Set.of(Kind.IMAGE, Kind.VIDEO),
            "LESSON_ATTACHMENT", Set.of(Kind.IMAGE, Kind.DOCUMENT));

    private final JdbcClient db;
    private final Path root;

    public FileStorageService(JdbcClient db, AppProperties props) {
        this.db = db;
        this.root = Path.of(props.uploadDir()).toAbsolutePath().normalize();
    }

    public Path root() {
        return root;
    }

    public Stored store(MultipartFile file, String purpose, long uploaderId) {
        Set<Kind> allowed = PURPOSES.get(purpose);
        if (allowed == null) {
            throw ApiException.validation("purpose", "Mục đích tải lên không hợp lệ");
        }
        if (file == null || file.isEmpty()) {
            throw ApiException.validation("file", "Vui lòng chọn tệp");
        }
        String original = file.getOriginalFilename() == null ? "tep" : Path.of(file.getOriginalFilename()).getFileName().toString();
        String detected = detect(file, original);
        Kind kind = allowed.stream().filter(k -> k.types.contains(detected)).findFirst()
                .orElseThrow(() -> ApiException.validation("file", "Định dạng tệp không được hỗ trợ"));
        if (file.getSize() > kind.maxBytes) {
            throw ApiException.validation("file", "Tệp vượt quá " + (kind.maxBytes / 1024 / 1024) + "MB");
        }
        String ext = switch (detected) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "application/pdf" -> ".pdf";
            case "video/mp4" -> ".mp4";
            default -> original.toLowerCase(Locale.ROOT).replaceAll("^.*(\\.(docx|xlsx|pptx))$", "$1");
        };
        LocalDate d = LocalDate.now();
        String key = "%s/%d/%02d/%s%s".formatted(purpose.toLowerCase(Locale.ROOT), d.getYear(), d.getMonthValue(),
                UUID.randomUUID(), ext);
        Path target = root.resolve(key).normalize();
        try {
            Files.createDirectories(target.getParent());
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Không lưu được tệp", e);
        }
        String url = "/files/" + key;
        long id = db.sql("""
                INSERT INTO dbo.uploaded_files (storage_key, public_url, original_name, content_type, size_bytes, purpose, uploaded_by)
                OUTPUT INSERTED.id VALUES (:k, :url, :name, :ct, :size, :p, :by)""")
                .param("k", key).param("url", url).param("name", original.length() > 255 ? original.substring(0, 255) : original)
                .param("ct", detected).param("size", file.getSize()).param("p", purpose).param("by", uploaderId)
                .query(Long.class).single();
        return new Stored(id, url, original, detected, file.getSize());
    }

    /** Xác định loại tệp theo nội dung (magic bytes), không tin đuôi tệp/Content-Type do client gửi. */
    private static String detect(MultipartFile file, String name) {
        byte[] h;
        try (InputStream in = file.getInputStream()) {
            h = in.readNBytes(16);
        } catch (IOException e) {
            throw ApiException.validation("file", "Không đọc được tệp");
        }
        if (h.length >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (h.length >= 8 && Arrays.equals(Arrays.copyOf(h, 8), new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A})) {
            return "image/png";
        }
        if (h.length >= 12 && new String(h, 0, 4, StandardCharsets.US_ASCII).equals("RIFF")
                && new String(h, 8, 4, StandardCharsets.US_ASCII).equals("WEBP")) {
            return "image/webp";
        }
        if (h.length >= 4 && new String(h, 0, 4, StandardCharsets.US_ASCII).equals("%PDF")) {
            return "application/pdf";
        }
        if (h.length >= 8 && new String(h, 4, 4, StandardCharsets.US_ASCII).equals("ftyp")) {
            return "video/mp4";
        }
        if (h.length >= 4 && h[0] == 'P' && h[1] == 'K' && h[2] == 3 && h[3] == 4) {
            String lower = name.toLowerCase(Locale.ROOT);
            if (lower.endsWith(".docx")) {
                return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            }
            if (lower.endsWith(".xlsx")) {
                return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            }
            if (lower.endsWith(".pptx")) {
                return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            }
        }
        return "application/octet-stream";
    }

    @Configuration
    static class ServeFiles implements WebMvcConfigurer {

        private final FileStorageService storage;

        ServeFiles(FileStorageService storage) {
            this.storage = storage;
        }

        @Override
        public void addResourceHandlers(ResourceHandlerRegistry registry) {
            registry.addResourceHandler("/files/**").addResourceLocations(storage.root().toUri().toString() + "/");
        }
    }
}
