# 01 — Quy ước thiết kế & kiểu dữ liệu

## 1. Phiên bản & edition SQL Server

| Môi trường | Edition | Chi phí | Ghi chú |
|------------|---------|---------|---------|
| Local / CI | SQL Server 2022 **Developer** (Docker image `mcr.microsoft.com/mssql/server`) | Miễn phí | Đầy đủ tính năng, **không được dùng cho production** |
| Staging | SQL Server 2022 **Express** | Miễn phí | Giống production để phát hiện sớm giới hạn |
| Production (MVP) | SQL Server 2022 **Express** | Miễn phí | Phù hợp mục tiêu tối ưu chi phí |
| Production (khi mở rộng) | SQL Server Standard (hoặc Azure SQL Database) | Có phí | Nâng cấp khi chạm giới hạn của Express |

**Giới hạn của Express cần theo dõi:**

| Giới hạn | Giá trị | Ảnh hưởng tới dự án |
|----------|---------|---------------------|
| Dung lượng mỗi database | **10 GB** (chỉ tính file dữ liệu, không tính log) | Ước tính năm đầu ~1–2 GB (xem [06](06-van-hanh-va-tich-hop.md) §5). Ảnh và video **không** lưu trong DB |
| CPU | Tối đa 1 socket hoặc 4 core | Đủ cho ~500 người dùng đồng thời với các chỉ mục đã thiết kế |
| Bộ nhớ buffer pool | ~1.4 GB | Dữ liệu hay đọc (khóa học, xếp hạng) nhỏ, vừa bộ nhớ đệm |
| SQL Server Agent | **Không có** | Sao lưu và bảo trì được lập lịch bằng cron/systemd hoặc Task Scheduler (xem 06) |
| Nén bản sao lưu (backup compression) | Không có | Nén bằng gzip/zstd sau khi sao lưu |

Phiên bản tối thiểu là **SQL Server 2019** (compatibility level 150), vì thiết kế dùng `STRING_SPLIT`, `ISJSON`, `OPENJSON`, filtered index, `OFFSET ... FETCH`.

## 2. Collation

```sql
CREATE DATABASE bdhvs COLLATE Vietnamese_100_CI_AS;
```

| Thành phần | Ý nghĩa | Lý do chọn |
|------------|---------|-----------|
| `Vietnamese_100` | Quy tắc sắp xếp tiếng Việt (a, ă, â, b, c, d, đ, ...) | `ORDER BY full_name` và `ORDER BY title` sắp xếp đúng theo tiếng Việt |
| `CI` | Không phân biệt hoa thường | `UNIQUE(email)` coi `An@x.com` và `an@x.com` là một. Tìm theo tên không phụ thuộc chữ hoa |
| `AS` | Phân biệt dấu | Giữ đúng tính duy nhất của tên: "Tin học" ≠ "Tín học". Việc tìm không dấu được xử lý riêng bằng `search_text` (§5) |

## 3. Quy ước đặt tên

| Đối tượng | Quy ước | Ví dụ |
|-----------|---------|-------|
| Schema | `dbo` | |
| Bảng | `snake_case`, danh từ số nhiều | `courses`, `quiz_attempts` |
| Cột | `snake_case`. Khóa ngoại có hậu tố `_id`. Thời điểm có hậu tố `_at`. Cờ có tiền tố `is_`/`show_` | `course_id`, `created_at`, `is_active` |
| Khóa chính | `pk_<bảng>` | `pk_courses` |
| Khóa ngoại | `fk_<bảng>_<tên quan hệ>` | `fk_courses_category` |
| Unique constraint | `uq_<bảng>_<cột>` | `uq_courses_slug` |
| Filtered unique index | `ux_<bảng>_<cột>` | `ux_users_email` |
| Chỉ mục thường | `ix_<bảng>_<cột>` | `ix_rankings_leaderboard` |
| CHECK | `ck_<bảng>_<quy tắc>` | `ck_users_status` |
| DEFAULT | `df_<bảng>_<cột>` | `df_users_created_at` |

Mọi constraint đều **đặt tên tường minh** để các migration Flyway sau này có thể `ALTER`/`DROP` chính xác. Không để SQL Server tự sinh tên ngẫu nhiên.

**Tránh từ khóa dành riêng:** `level` → `course_level`, `type` → `question_type`, `action` → `action_type`.

## 4. Ánh xạ kiểu dữ liệu

| Loại dữ liệu | Kiểu SQL Server | Kiểu Java (JPA) | Ghi chú |
|--------------|-----------------|-----------------|---------|
| Khóa chính / khóa ngoại | `BIGINT IDENTITY(1,1)` | `Long` | Bảng `roles` dùng `SMALLINT` |
| Chuỗi ngắn | `NVARCHAR(n)` | `String` | **Mọi** cột chuỗi đều là `NVARCHAR`, xem giải thích bên dưới |
| Văn bản dài / HTML | `NVARCHAR(MAX)` | `String` (`@Lob` không bắt buộc) | Nội dung bài học, mô tả khóa học |
| JSON | `NVARCHAR(MAX)` + `CHECK (ISJSON(col) = 1)` | `String` hoặc `AttributeConverter` | `certificate_criteria`, `question_order`, `before_data`/`after_data` |
| Đúng/sai | `BIT` | `boolean` | `NOT NULL` + DEFAULT |
| Số nguyên nhỏ | `TINYINT` (0..255) / `SMALLINT` | `Short`/`Integer` | Phần trăm, số sao, năm sinh |
| Số nguyên | `INT` | `Integer` | Thứ tự, thời lượng (giây/phút), bộ đếm |
| Điểm số | `DECIMAL(p,s)` | `BigDecimal` | `DECIMAL(5,2)` điểm câu, `DECIMAL(7,2)` điểm lượt, `DECIMAL(9,2)` tổng điểm |
| Thời điểm | `DATETIME2(3)` — **luôn là UTC** | `Instant` | Mặc định `SYSUTCDATETIME()`. Ứng dụng đặt `hibernate.jdbc.time_zone=UTC` |
| Trạng thái (enum) | `NVARCHAR(20..30)` + `CHECK (col IN (...))` | `enum` + `@Enumerated(EnumType.STRING)` | Dễ đọc, dễ mở rộng bằng `ALTER ... CHECK` |
| Khóa lạc quan | `version INT NOT NULL DEFAULT 0` | `@Version int` | Chống ghi đè khi 2 admin cùng sửa một bản ghi |

**Tại sao dùng `NVARCHAR` cho cả cột chỉ chứa ASCII (email, slug, mã trạng thái, hash)?**
Microsoft JDBC Driver mặc định gửi mọi tham số chuỗi dưới dạng `NVARCHAR` (`sendStringParametersAsUnicode=true`). Nếu cột là `VARCHAR`, SQL Server phải chuyển đổi kiểu ngầm, có thể khiến chỉ mục bị quét toàn bộ thay vì seek. Đổi cấu hình driver thành `false` lại có nguy cơ làm hỏng dữ liệu tiếng Việt. Dùng `NVARCHAR` thống nhất là cách đơn giản và an toàn nhất. Dung lượng tăng thêm không đáng kể ở quy mô dự án.

**Giới hạn khóa chỉ mục:** khóa của nonclustered index tối đa 1.700 byte, tức `NVARCHAR(850)`. Các cột được đánh chỉ mục trong thiết kế đều ≤ `NVARCHAR(500)`.

## 5. Tìm kiếm tiếng Việt không dấu

Yêu cầu FR-CRS-01: gõ "an toan thong tin" phải tìm thấy "An toàn thông tin".

Collation `Vietnamese_100_CI_AI` hoặc `Latin1_General_CI_AI` **không** giải quyết trọn vẹn yêu cầu này, vì `đ` là một chữ cái riêng chứ không phải `d` có dấu. Do đó thiết kế dùng **cột chuẩn hóa do ứng dụng sinh**:

```
courses.search_text = normalize(title) + ' ' + normalize(short_description) + ' ' + normalize(organization.name)
```

Hàm `normalize` ở backend (Java):

```java
public static String normalize(String s) {
    if (s == null) return "";
    String n = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")          // bỏ dấu thanh, dấu mũ, dấu móc
            .replace('đ', 'd').replace('Đ', 'D');
    return n.toLowerCase(java.util.Locale.ROOT).replaceAll("\\s+", " ").trim();
}
```

- `search_text` được tính lại mỗi khi tạo/sửa khóa học, và khi đổi tên tổ chức đào tạo (cập nhật mọi khóa học của tổ chức đó).
- Từ khóa người dùng nhập cũng đi qua `normalize`, sau đó thoát ký tự đặc biệt của `LIKE` (`%`, `_`, `[`).
- Câu truy vấn: `WHERE c.search_text LIKE N'%' + @kw + N'%'`. Với ≤ 10.000 khóa học, quét bảng đã lọc theo `publish_status` vẫn trong vài mili-giây.
- **Khi mở rộng:** bật SQL Server Full-Text Search (có trong Express with Advanced Services; image Docker Linux cần cài thêm gói `mssql-server-fts`), tạo full-text index trên `search_text` và đổi sang `CONTAINS(search_text, '"an toan*"')`.

## 6. Quy ước dữ liệu thời gian

- Tất cả cột `*_at`, `start_date`, `end_date` lưu **UTC**.
- Frontend hiển thị theo `Asia/Ho_Chi_Minh` (UTC+7).
- Khi Admin chọn "ngày bắt đầu 01/11/2026" (giờ Việt Nam), backend lưu `2026-10-31 17:00:00.000`.
- `DATETIME2(3)` có độ chính xác mili-giây. Thời gian làm bài (`duration_seconds`) tính bằng `DATEDIFF(SECOND, started_at, submitted_at)` hoặc ở tầng Java.

## 7. Cột chuẩn của mỗi bảng

| Cột | Có ở bảng | Mô tả |
|-----|-----------|-------|
| `id BIGINT IDENTITY` | Mọi bảng có thực thể độc lập | Bảng nối và bảng tổng hợp dùng khóa chính tổ hợp |
| `created_at` | Mọi bảng | `DEFAULT SYSUTCDATETIME()` |
| `updated_at` | Bảng có cập nhật | Ứng dụng gán khi cập nhật (`@UpdateTimestamp`). Không dùng trigger |
| `version` | `users`, `organizations`, `course_categories`, `courses`, `lessons`, `quizzes`, `questions`, `enrollments` | Optimistic locking |
| `deleted_at` | `users` | Xóa mềm |
