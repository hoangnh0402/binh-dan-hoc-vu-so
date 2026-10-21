# 02 — Từ điển dữ liệu

Ký hiệu cột **Null**: ✔ = cho phép NULL, để trống = `NOT NULL`. **Khóa**: PK, FK, UK (unique). Tên constraint đầy đủ nằm trong [04-script-tao-csdl.md](04-script-tao-csdl.md).

Các cột chuẩn `created_at`, `updated_at` (`DATETIME2(3)`, mặc định `SYSUTCDATETIME()`) và `version` (`INT`, mặc định 0) không mô tả lặp lại ở từng bảng.

---

## 1. Người dùng & xác thực

### 1.1 `roles` — Vai trò

Truy vết: FR-AUTH-10, knowledge base "Role: Admin, User".

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | SMALLINT IDENTITY | | PK | | Cố định: 1 = ADMIN, 2 = USER |
| code | NVARCHAR(30) | | UK | | Mã vai trò dùng trong code |
| name | NVARCHAR(100) | | | | Tên hiển thị tiếng Việt |
| created_at | DATETIME2(3) | | | now | |

### 1.2 `users` — Người dùng

Truy vết: FR-AUTH-01, 04, 09; FR-ADM-01..06; knowledge base "tên, năm sinh, quê, nơi công tác".

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| email | NVARCHAR(255) | | UK* | | Lưu chữ thường. *Duy nhất trong các bản ghi `deleted_at IS NULL` |
| password_hash | NVARCHAR(100) | | | | BCrypt (60 ký tự) |
| full_name | NVARCHAR(100) | | | | Họ và tên |
| birth_year | SMALLINT | ✔ | | | Năm sinh, 1900 → năm hiện tại |
| hometown | NVARCHAR(255) | ✔ | | | Quê quán |
| workplace | NVARCHAR(255) | ✔ | | | Nơi công tác |
| phone | NVARCHAR(20) | ✔ | | | Số điện thoại |
| avatar_url | NVARCHAR(500) | ✔ | | | URL ảnh đại diện |
| status | NVARCHAR(30) | | | `PENDING_VERIFICATION` | `PENDING_VERIFICATION` · `ACTIVE` · `LOCKED` |
| lock_reason | NVARCHAR(500) | ✔ | | | Lý do Admin khóa |
| email_verified_at | DATETIME2(3) | ✔ | | | Thời điểm xác thực OTP |
| failed_login_count | SMALLINT | | | 0 | Số lần sai mật khẩu liên tiếp (BR-AUTH-05) |
| locked_until | DATETIME2(3) | ✔ | | | Khóa tạm tới thời điểm này (sai mật khẩu 5 lần) |
| last_login_at | DATETIME2(3) | ✔ | | | |
| show_on_leaderboard | BIT | | | 1 | 0 = hiển thị "Học viên ẩn danh" trên bảng xếp hạng |
| privacy_consent_at | DATETIME2(3) | ✔ | | | Thời điểm đồng ý chính sách dữ liệu cá nhân (NFR-PRV-01). Bắt buộc với tài khoản tự đăng ký, NULL với tài khoản do Admin tạo |
| version, created_at, updated_at | | | | | Cột chuẩn |
| deleted_at | DATETIME2(3) | ✔ | | | Xóa mềm (FR-ADM-06) |

### 1.3 `user_roles` — Gán vai trò

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| user_id | BIGINT | | PK, FK → users (CASCADE) | | |
| role_id | SMALLINT | | PK, FK → roles | | |
| assigned_at | DATETIME2(3) | | | now | |

### 1.4 `otp_codes` — Mã OTP

Truy vết: FR-AUTH-02, 03, 07; BR-AUTH-02..04.

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| user_id | BIGINT | | FK → users (CASCADE) | | |
| purpose | NVARCHAR(30) | | | | `REGISTER` · `RESET_PASSWORD` |
| code_hash | NVARCHAR(100) | | | | Hash của mã 6 số (HMAC-SHA256 hoặc BCrypt) |
| expires_at | DATETIME2(3) | | | | `created_at + 5 phút` |
| failed_attempts | TINYINT | | | 0 | 0..5 (BR-AUTH-03) |
| consumed_at | DATETIME2(3) | ✔ | | | Đã dùng thành công |
| invalidated_at | DATETIME2(3) | ✔ | | | Bị vô hiệu (gửi mã mới / sai quá 5 lần) |
| request_ip | NVARCHAR(45) | ✔ | | | IPv4/IPv6 của người yêu cầu |
| created_at | DATETIME2(3) | | | now | Dùng để đếm giới hạn 5 lần/giờ, cách nhau 60 giây |

Một OTP **còn hiệu lực** khi: `consumed_at IS NULL AND invalidated_at IS NULL AND expires_at > now`.

### 1.5 `password_reset_tokens` — Phiên đặt lại mật khẩu

Truy vết: FR-AUTH-07, FR-ADM-02, FR-ADM-04.

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| user_id | BIGINT | | FK → users (CASCADE) | | |
| token_hash | NVARCHAR(100) | | UK | | SHA-256 của `resetToken` |
| source | NVARCHAR(20) | | | `SELF` | `SELF`: hiệu lực 10 phút sau khi xác thực OTP · `ADMIN`: link Admin gửi, hiệu lực 24 giờ |
| expires_at | DATETIME2(3) | | | | |
| used_at | DATETIME2(3) | ✔ | | | Dùng một lần |
| created_at | DATETIME2(3) | | | now | |

### 1.6 `refresh_tokens` — Phiên đăng nhập

Truy vết: FR-AUTH-05, 06; mục 2.2 SRS 01.

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| user_id | BIGINT | | FK → users (CASCADE) | | |
| token_hash | NVARCHAR(100) | | UK | | SHA-256 của refresh token |
| remember_me | BIT | | | 0 | 1 = hạn 30 ngày, 0 = 7 ngày |
| expires_at | DATETIME2(3) | | | | |
| revoked_at | DATETIME2(3) | ✔ | | | |
| revoked_reason | NVARCHAR(30) | ✔ | | | `ROTATED` · `LOGOUT` · `LOGOUT_ALL` · `PASSWORD_CHANGED` · `REUSE_DETECTED` · `ACCOUNT_LOCKED` |
| replaced_by_id | BIGINT | ✔ | FK → refresh_tokens | | Token mới thay thế khi xoay vòng. Nếu token đã `ROTATED` bị dùng lại thì thu hồi toàn bộ |
| user_agent | NVARCHAR(500) | ✔ | | | |
| ip_address | NVARCHAR(45) | ✔ | | | |
| created_at | DATETIME2(3) | | | now | |

---

## 2. Danh mục & nội dung

### 2.1 `uploaded_files` — Tệp đã tải lên

Truy vết: FR-ADM-23, FR-AUTH-09. Nội dung tệp nằm trên object storage, DB chỉ lưu metadata.

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| storage_key | NVARCHAR(500) | | UK | | Khóa đối tượng trên S3/MinIO (tên ngẫu nhiên) |
| public_url | NVARCHAR(500) | | | | URL truy cập |
| original_name | NVARCHAR(255) | | | | Tên tệp gốc (để hiển thị/tải về) |
| content_type | NVARCHAR(100) | | | | MIME type đã kiểm tra bằng magic bytes |
| size_bytes | BIGINT | | | | > 0 |
| purpose | NVARCHAR(30) | | | | `AVATAR` · `COURSE_THUMBNAIL` · `LESSON_CONTENT` · `LESSON_ATTACHMENT` · `CATEGORY_ICON` · `ORGANIZATION_LOGO` · `QUESTION_IMAGE` |
| uploaded_by | BIGINT | | FK → users | | |
| created_at | DATETIME2(3) | | | now | |

### 2.2 `organizations` — Tổ chức đào tạo

Truy vết: FR-ADM-11, bộ lọc FR-CRS-02.

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| name | NVARCHAR(200) | | UK | | |
| slug | NVARCHAR(220) | | UK | | |
| logo_url | NVARCHAR(500) | ✔ | | | |
| website | NVARCHAR(500) | ✔ | | | |
| contact_email | NVARCHAR(255) | ✔ | | | |
| description | NVARCHAR(MAX) | ✔ | | | |
| is_active | BIT | | | 1 | 0 = ẩn khỏi bộ lọc. Không xóa được khi còn khóa học |
| version, created_at, updated_at | | | | | Cột chuẩn |

### 2.3 `course_categories` — Loại khóa học (2 cấp)

Truy vết: FR-ADM-07..10, BR-ADM-02..05; knowledge base "Loại khóa học cấp 1, cấp 2 (con của cấp 1)".

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK, UK(id, depth) | | |
| parent_id | BIGINT | ✔ | FK (parent_id, parent_depth) → (id, depth) | | NULL = loại cấp 1 |
| depth | TINYINT | | | | 1 = cấp 1, 2 = cấp 2 |
| parent_depth | TINYINT | ✔ | (thuộc FK trên) | | NULL khi cấp 1, luôn = 1 khi cấp 2 → bảo đảm cha là cấp 1 |
| name | NVARCHAR(150) | | UK(parent_id, name) | | Không trùng tên trong cùng cấp cha |
| slug | NVARCHAR(170) | | UK | | |
| description | NVARCHAR(1000) | ✔ | | | |
| icon_url | NVARCHAR(500) | ✔ | | | |
| sort_order | INT | | | 0 | Thứ tự hiển thị trong cùng cấp |
| is_active | BIT | | | 1 | BR-ADM-05 |
| version, created_at, updated_at | | | | | Cột chuẩn |

**Cách ứng dụng ghi dữ liệu:** tạo loại cấp 1 thì đặt `parent_id = NULL, depth = 1, parent_depth = NULL`. Tạo loại cấp 2 thì đặt `parent_id = <id cấp 1>, depth = 2, parent_depth = 1`. Mọi tổ hợp khác đều bị CHECK/FK từ chối.

### 2.4 `courses` — Khóa học

Truy vết: FR-ADM-12..15, FR-CRS-01..08, BR-CRS-01..05, BR-ADM-03, 06..08.

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| category_id | BIGINT | | FK (category_id, category_depth) → course_categories (id, depth) | | Loại khóa học **cấp 2** |
| category_depth | TINYINT | | | 2 | Luôn = 2 (CHECK) → buộc FK trỏ tới loại cấp 2 |
| organization_id | BIGINT | | FK → organizations | | |
| title | NVARCHAR(200) | | | | 5–200 ký tự (kiểm tra ở ứng dụng) |
| slug | NVARCHAR(220) | | UK | | |
| short_description | NVARCHAR(300) | | | | Hiển thị trên thẻ khóa học |
| description | NVARCHAR(MAX) | | | | HTML đã sanitize |
| outcomes | NVARCHAR(MAX) | ✔ | | | Mục tiêu đầu ra |
| target_audience | NVARCHAR(MAX) | ✔ | | | Đối tượng phù hợp |
| prerequisites | NVARCHAR(MAX) | ✔ | | | Yêu cầu đầu vào |
| thumbnail_url | NVARCHAR(500) | ✔ | | | Bắt buộc trước khi xuất bản (BR-ADM-06, kiểm tra ở ứng dụng) |
| course_level | NVARCHAR(20) | | | | `BASIC` · `INTERMEDIATE` · `ADVANCED` |
| publish_status | NVARCHAR(20) | | | `DRAFT` | `DRAFT` · `PUBLISHED` · `ARCHIVED` |
| start_date | DATETIME2(3) | ✔ | | | NULL = mở ngay |
| end_date | DATETIME2(3) | ✔ | | | NULL = không kết thúc. `end_date > start_date` |
| estimated_minutes | INT | ✔ | | | Thời lượng ước tính |
| is_featured | BIT | | | 0 | Khóa học nổi bật trên trang chủ |
| certificate_criteria | NVARCHAR(MAX) | ✔ | | | JSON, ví dụ `{"minProgress":100,"minAvgScorePercent":70}` (Giai đoạn 2) |
| search_text | NVARCHAR(1000) | | | `''` | Chuỗi không dấu, chữ thường để tìm kiếm (01 §5) |
| published_lesson_count | INT | | | 0 | Cột tổng hợp: số bài `is_published = 1` |
| enrollment_count | INT | | | 0 | Cột tổng hợp: số ghi danh `IN_PROGRESS` + `COMPLETED` |
| rating_avg | DECIMAL(3,2) | | | 0 | Cột tổng hợp: trung bình sao của đánh giá không bị ẩn |
| rating_count | INT | | | 0 | Cột tổng hợp |
| published_at | DATETIME2(3) | ✔ | | | Lần xuất bản đầu tiên. Bắt buộc khi khác `DRAFT` |
| created_by | BIGINT | | FK → users | | |
| updated_by | BIGINT | ✔ | FK → users | | |
| version, created_at, updated_at | | | | | Cột chuẩn |

**Trạng thái thời gian** (BR-CRS-01) không được lưu mà tính khi truy vấn:

| Giá trị | Điều kiện |
|---------|-----------|
| `UPCOMING` — Sắp mở | `start_date > now` |
| `OPEN` — Đang mở | `(start_date IS NULL OR start_date <= now) AND (end_date IS NULL OR end_date >= now)` |
| `ENDED` — Đã kết thúc | `end_date < now` |

### 2.5 `lessons` — Bài học

Truy vết: FR-ADM-16, FR-LRN-01..03; knowledge base "bài học: đề bài".

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| course_id | BIGINT | | FK → courses (CASCADE) | | |
| title | NVARCHAR(200) | | | | |
| order_index | INT | | UK(course_id, order_index) | | Bắt đầu từ 1. Quyết định thứ tự mở khóa |
| content | NVARCHAR(MAX) | ✔ | | | Nội dung lý thuyết (HTML) |
| video_url | NVARCHAR(500) | ✔ | | | YouTube/Vimeo/MP4 |
| assignment | NVARCHAR(MAX) | ✔ | | | **Đề bài** (HTML) |
| estimated_minutes | INT | ✔ | | | |
| is_published | BIT | | | 0 | Bài chưa xuất bản không hiển thị và không tính vào tiến độ |
| version, created_at, updated_at | | | | | Cột chuẩn |

### 2.6 `lesson_attachments` — Tệp đính kèm bài học

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| lesson_id | BIGINT | | FK → lessons (CASCADE), UK(lesson_id, file_id) | | |
| file_id | BIGINT | | FK → uploaded_files | | |
| display_name | NVARCHAR(255) | | | | Tên hiển thị cho người học |
| order_index | INT | | | 0 | |
| created_at | DATETIME2(3) | | | now | |

### 2.7 `quizzes` — Quiz của bài học

Truy vết: FR-ADM-17, FR-LRN-04..06. Mỗi bài học có tối đa 1 quiz.

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| lesson_id | BIGINT | | FK → lessons (CASCADE), UK | | |
| title | NVARCHAR(200) | | | | |
| pass_score_percent | TINYINT | | | 70 | Điểm đạt (%) |
| time_limit_seconds | INT | ✔ | | | NULL = không giới hạn thời gian |
| max_attempts | INT | ✔ | | | NULL = không giới hạn lượt (Q-06) |
| retry_cooldown_seconds | INT | | | 0 | Thời gian chờ giữa 2 lượt |
| shuffle_questions | BIT | | | 0 | |
| shuffle_options | BIT | | | 0 | |
| show_answers_after_submit | BIT | | | 1 | Cho xem đáp án đúng và giải thích sau khi nộp |
| version, created_at, updated_at | | | | | Cột chuẩn |

### 2.8 `questions` — Câu hỏi

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| quiz_id | BIGINT | | FK → quizzes (CASCADE) | | |
| content | NVARCHAR(MAX) | | | | Nội dung câu hỏi (HTML, cho phép ảnh) |
| question_type | NVARCHAR(20) | | | | `SINGLE_CHOICE` · `MULTIPLE_CHOICE` · `TRUE_FALSE` |
| points | DECIMAL(5,2) | | | 1 | > 0 |
| explanation | NVARCHAR(MAX) | ✔ | | | Giải thích đáp án |
| order_index | INT | | | 0 | |
| is_active | BIT | | | 1 | 0 = đã gỡ khỏi quiz nhưng giữ lại vì đã có người trả lời |
| version, created_at, updated_at | | | | | Cột chuẩn |

### 2.9 `question_options` — Đáp án

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| question_id | BIGINT | | FK → questions (CASCADE) | | |
| content | NVARCHAR(1000) | | | | |
| is_correct | BIT | | | 0 | **Không bao giờ gửi về client trước khi nộp bài** (BR-LRN-04) |
| order_index | INT | | | 0 | |
| is_active | BIT | | | 1 | |
| created_at, updated_at | | | | | Cột chuẩn |

Ràng buộc liên dòng (kiểm tra ở tầng service khi lưu câu hỏi): mỗi câu có 2–8 đáp án đang hoạt động. `SINGLE_CHOICE`/`TRUE_FALSE` có đúng 1 đáp án đúng. `MULTIPLE_CHOICE` có ít nhất 1 đáp án đúng.

---

## 3. Học tập

### 3.1 `enrollments` — Ghi danh

Truy vết: FR-CRS-09, 11; FR-LRN-08, 09, 11; knowledge base "đăng ký học: thanh check tiến độ".

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| user_id | BIGINT | | FK → users, UK(user_id, course_id) | | |
| course_id | BIGINT | | FK → courses | | |
| status | NVARCHAR(20) | | | `IN_PROGRESS` | `IN_PROGRESS` · `COMPLETED` · `CANCELLED` |
| progress_percent | TINYINT | | | 0 | Thanh tiến độ = `completed_lesson_count * 100 / published_lesson_count` (làm tròn xuống) |
| completed_lesson_count | INT | | | 0 | |
| last_lesson_id | BIGINT | ✔ | FK → lessons | | Phục vụ "Tiếp tục học" |
| enrolled_at | DATETIME2(3) | | | now | |
| completed_at | DATETIME2(3) | ✔ | | | Bắt buộc khi `COMPLETED` |
| cancelled_at | DATETIME2(3) | ✔ | | | Bắt buộc khi `CANCELLED`. Đăng ký lại thì cập nhật bản ghi cũ về `IN_PROGRESS` (giữ tiến độ) |
| version, updated_at | | | | | Cột chuẩn |

### 3.2 `lesson_progress` — Tiến độ từng bài

Truy vết: FR-LRN-07, BR-LRN-01, 02. Chỉ lưu `IN_PROGRESS`/`COMPLETED`. `LOCKED`/`UNLOCKED` được tính khi truy vấn ([05](05-truy-van-nghiep-vu.md) §2).

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| enrollment_id | BIGINT | | FK → enrollments (CASCADE), UK(enrollment_id, lesson_id) | | |
| lesson_id | BIGINT | | FK → lessons | | |
| status | NVARCHAR(20) | | | `IN_PROGRESS` | |
| completion_method | NVARCHAR(20) | ✔ | | | `QUIZ_PASSED` · `MANUAL` (bài không có quiz) |
| started_at | DATETIME2(3) | | | now | Lần đầu mở bài |
| completed_at | DATETIME2(3) | ✔ | | | |

### 3.3 `quiz_attempts` — Lượt làm quiz

Truy vết: FR-LRN-04..06, 10; BR-LRN-03..05; BR-RNK-03.

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| quiz_id | BIGINT | | FK → quizzes | | |
| user_id | BIGINT | | FK → users | | |
| enrollment_id | BIGINT | | FK → enrollments | | |
| attempt_no | INT | | UK(user_id, quiz_id, attempt_no) | | Lượt thứ mấy, dùng để kiểm tra `max_attempts` |
| status | NVARCHAR(20) | | | `IN_PROGRESS` | `IN_PROGRESS` · `SUBMITTED` · `EXPIRED` (hết giờ, hệ thống tự chấm) |
| question_order | NVARCHAR(MAX) | ✔ | | | JSON thứ tự câu/đáp án đã xáo, ví dụ `[{"q":301,"o":[1203,1201,1202]}]` |
| started_at | DATETIME2(3) | | | now | Giờ máy chủ (BR-LRN-05) |
| expires_at | DATETIME2(3) | ✔ | | | `started_at + time_limit_seconds + 30s` (bù trễ mạng) |
| submitted_at | DATETIME2(3) | ✔ | | | |
| duration_seconds | INT | ✔ | | | `submitted_at − started_at`. Dùng để phá hòa khi xếp hạng |
| score | DECIMAL(7,2) | ✔ | | | |
| max_score | DECIMAL(7,2) | ✔ | | | Tổng điểm các câu `is_active = 1` tại thời điểm bắt đầu |
| score_percent | DECIMAL(5,2) | ✔ | | | |
| passed | BIT | ✔ | | | `score_percent >= pass_score_percent` |
| counts_for_ranking | BIT | ✔ | | | 0 nếu nộp sau `courses.end_date` (BR-LRN-07) |

Có filtered unique index `ux_quiz_attempts_in_progress`, bảo đảm mỗi người chỉ có **1 lượt `IN_PROGRESS`** cho mỗi quiz. Khi đã nộp (`SUBMITTED`/`EXPIRED`), CHECK bắt buộc phải có đủ kết quả.

### 3.4 `quiz_attempt_answers` — Câu trả lời

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| attempt_id | BIGINT | | FK → quiz_attempts (CASCADE), UK(attempt_id, question_id) | | |
| question_id | BIGINT | | FK → questions | | |
| is_correct | BIT | ✔ | | | NULL khi mới lưu nháp, được gán khi chấm |
| points_awarded | DECIMAL(5,2) | ✔ | | | |
| answered_at | DATETIME2(3) | | | now | Lần lưu gần nhất |

### 3.5 `quiz_attempt_answer_options` — Đáp án đã chọn

Thay cho cột mảng `selected_option_ids BIGINT[]` của thiết kế PostgreSQL.

| Cột | Kiểu | Null | Khóa | Mô tả |
|-----|------|:----:|:----:|-------|
| answer_id | BIGINT | | PK, FK → quiz_attempt_answers (CASCADE) | |
| option_id | BIGINT | | PK, FK → question_options | Đáp án người học đã chọn |

---

## 4. Xếp hạng

### 4.1 `quiz_best_attempts` — Lượt tốt nhất mỗi quiz

Truy vết: BR-RNK-01 (điểm cao nhất, bằng điểm thì thời gian ngắn hơn, bằng nữa thì nộp sớm hơn).

| Cột | Kiểu | Null | Khóa | Mô tả |
|-----|------|:----:|:----:|-------|
| user_id | BIGINT | | PK, FK → users | |
| quiz_id | BIGINT | | PK, FK → quizzes | |
| course_id | BIGINT | | FK → courses | Phi chuẩn hóa để cộng tổng theo khóa học nhanh |
| attempt_id | BIGINT | | FK → quiz_attempts, UK | |
| score | DECIMAL(7,2) | | | |
| duration_seconds | INT | | | |
| achieved_at | DATETIME2(3) | | | `submitted_at` của lượt tốt nhất |
| updated_at | DATETIME2(3) | | | |

Chỉ các lượt có `counts_for_ranking = 1` mới được xét.

### 4.2 `rankings` — Điểm xếp hạng theo khóa học

Truy vết: FR-RNK-01..04; knowledge base "ranking: id người dùng, id khóa học, điểm".

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| user_id | BIGINT | | PK, FK → users | | |
| course_id | BIGINT | | PK, FK → courses | | |
| total_score | DECIMAL(9,2) | | | 0 | Σ `quiz_best_attempts.score` của khóa |
| total_duration_seconds | INT | | | 0 | Σ thời gian các lượt tốt nhất. **Bằng điểm thì ai ít thời gian hơn xếp trên** |
| completed_quiz_count | INT | | | 0 | Số quiz đã có lượt tính điểm |
| last_achieved_at | DATETIME2(3) | ✔ | | | `MAX(achieved_at)`, tiêu chí phá hòa cấp 3 |
| updated_at | DATETIME2(3) | | | now | |

Thứ hạng **không được lưu** mà tính bằng `RANK()` khi đọc, nhờ chỉ mục `ix_rankings_leaderboard`.

---

## 5. Đánh giá

### 5.1 `course_reviews` — Đánh giá khóa học

Truy vết: FR-CRS-07, BR-CRS-03, FR-ADM-20.

| Cột | Kiểu | Null | Khóa | Mặc định | Mô tả |
|-----|------|:----:|:----:|----------|-------|
| id | BIGINT IDENTITY | | PK | | |
| course_id | BIGINT | | FK → courses, UK(course_id, user_id) | | Mỗi người 1 đánh giá/khóa |
| user_id | BIGINT | | FK → users | | |
| rating | TINYINT | | | | 1..5 sao |
| comment | NVARCHAR(1000) | ✔ | | | |
| is_hidden | BIT | | | 0 | Admin ẩn. Không tính vào `rating_avg` |
| hidden_reason | NVARCHAR(500) | ✔ | | | |
| hidden_by | BIGINT | ✔ | FK → users | | Bắt buộc khi `is_hidden = 1` |
| hidden_at | DATETIME2(3) | ✔ | | | Bắt buộc khi `is_hidden = 1` |
| created_at, updated_at | | | | | Cột chuẩn |

---

## 6. Hệ thống

### 6.1 `audit_logs` — Nhật ký thao tác quản trị

Truy vết: FR-ADM-22. Lưu tối thiểu 1 năm.

| Cột | Kiểu | Null | Khóa | Mô tả |
|-----|------|:----:|:----:|-------|
| id | BIGINT IDENTITY | | PK | |
| actor_id | BIGINT | ✔ | FK → users | NULL = job hệ thống / khởi tạo |
| action_type | NVARCHAR(30) | | | `CREATE` · `UPDATE` · `DELETE` · `LOCK` · `UNLOCK` · `PUBLISH` · `UNPUBLISH` · `ARCHIVE` · `RESTORE` · `HIDE` · `SHOW` · `ROLE_CHANGE` · `RESET_PASSWORD` · `RECALCULATE_RANKING` · `IMPORT` · `EXPORT` |
| entity_type | NVARCHAR(50) | | | Tên thực thể, ví dụ `COURSE`, `USER` |
| entity_id | BIGINT | ✔ | | |
| before_data | NVARCHAR(MAX) | ✔ | | JSON trước thay đổi (đã loại bỏ trường nhạy cảm như `password_hash`) |
| after_data | NVARCHAR(MAX) | ✔ | | JSON sau thay đổi |
| ip_address | NVARCHAR(45) | ✔ | | |
| user_agent | NVARCHAR(500) | ✔ | | |
| created_at | DATETIME2(3) | | | |

---

## 7. Bảng dự kiến cho Giai đoạn 2–3 (chưa tạo)

| Bảng | Cột chính | Giai đoạn |
|------|-----------|-----------|
| `certificates` | `id`, `user_id` FK, `course_id` FK, `code NVARCHAR(30)` UK (mã tra cứu), `issued_at`, `file_id` FK → uploaded_files, `revoked_at`; UK(`user_id`, `course_id`) | 2 |
| `notifications` | `id`, `user_id` FK, `type`, `title`, `body`, `link_url`, `read_at`, `created_at` | 2 |
| `user_identities` | `id`, `user_id` FK, `provider` (`GOOGLE`), `provider_user_id`; UK(`provider`, `provider_user_id`) | 2 |
| `blog_categories`, `blog_posts`, `blog_tags`, `blog_post_tags`, `blog_comments` | Bài viết có `slug`, `status`, `author_id`, `published_at`, nội dung `NVARCHAR(MAX)` | 3 |
| Vai trò `INSTRUCTOR`, `ORG_MANAGER` + bảng `organization_members` | `organization_id`, `user_id`, `member_role` | 3 |
