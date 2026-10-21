# 08 — Đặc tả API

REST API, JSON, tiền tố `/api/v1`. Tài liệu chi tiết từng trường được sinh tự động bằng OpenAPI (Swagger UI tại `/api/docs` — chỉ bật ở dev/staging).

## 1. Quy ước chung

### 1.1 Xác thực

- Header `Authorization: Bearer <accessToken>` cho API cần đăng nhập.
- Refresh token nằm trong cookie `refresh_token` (`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`).

### 1.2 Phân trang, lọc, sắp xếp

- Query: `page` (bắt đầu từ 0), `size` (mặc định 20, tối đa 50), `sort=field,asc|desc`.
- Bộ lọc nhiều giá trị: phân tách bằng dấu phẩy, ví dụ `level=BASIC,INTERMEDIATE`.

Response danh sách:

```json
{
  "items": [ ... ],
  "page": 0,
  "size": 12,
  "totalItems": 128,
  "totalPages": 11
}
```

### 1.3 Lỗi

```json
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ",
  "errors": [
    { "field": "email", "message": "Email không đúng định dạng" }
  ],
  "traceId": "9f1c2e..."
}
```

| HTTP | `code` tiêu biểu | Khi nào |
|------|------------------|---------|
| 400 | `VALIDATION_ERROR` | Dữ liệu vào sai |
| 401 | `UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS` | Chưa đăng nhập / token hết hạn / sai thông tin |
| 403 | `FORBIDDEN`, `ACCOUNT_LOCKED`, `ACCOUNT_NOT_VERIFIED`, `NOT_ENROLLED`, `LESSON_LOCKED`, `COURSE_NOT_STARTED` | Không đủ quyền / vi phạm quy tắc |
| 404 | `NOT_FOUND` | Không tồn tại |
| 409 | `EMAIL_EXISTS`, `ALREADY_ENROLLED`, `CATEGORY_HAS_CHILDREN`, `CATEGORY_HAS_COURSES`, `COURSE_HAS_ENROLLMENTS` | Xung đột dữ liệu |
| 422 | `OTP_INVALID`, `OTP_EXPIRED`, `MAX_ATTEMPTS_REACHED`, `COURSE_NOT_PUBLISHABLE` | Vi phạm nghiệp vụ |
| 429 | `TOO_MANY_REQUESTS`, `OTP_RESEND_TOO_SOON` | Vượt giới hạn tần suất |

## 2. Xác thực — `/api/v1/auth`

| Method | Endpoint | Mô tả | Yêu cầu |
|--------|----------|-------|---------|
| POST | `/auth/register` | Đăng ký, gửi OTP | FR-AUTH-01 |
| POST | `/auth/verify-otp` | Xác thực OTP đăng ký → trả token | FR-AUTH-02 |
| POST | `/auth/resend-otp` | Gửi lại OTP `{email, purpose}` | FR-AUTH-03 |
| POST | `/auth/login` | Đăng nhập | FR-AUTH-04 |
| POST | `/auth/refresh` | Làm mới access token | FR-AUTH-05 |
| POST | `/auth/logout` | Đăng xuất (`?all=true` — mọi thiết bị) | FR-AUTH-06 |
| POST | `/auth/forgot-password` | Gửi OTP đặt lại mật khẩu | FR-AUTH-07 |
| POST | `/auth/forgot-password/verify` | Xác thực OTP → `resetToken` | FR-AUTH-07 |
| POST | `/auth/reset-password` | Đặt mật khẩu mới | FR-AUTH-07 |

Ví dụ đăng nhập:

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "an.nguyen@example.com", "password": "MatKhau123", "rememberMe": true }
```

```json
200 OK
Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth

{
  "accessToken": "eyJhbGciOi...",
  "expiresIn": 900,
  "user": { "id": 15, "fullName": "Nguyễn Văn An", "email": "an.nguyen@example.com", "roles": ["USER"] }
}
```

## 3. Tài khoản cá nhân — `/api/v1/me`

| Method | Endpoint | Mô tả | Yêu cầu |
|--------|----------|-------|---------|
| GET | `/me` | Hồ sơ của tôi | FR-AUTH-09 |
| PUT | `/me` | Cập nhật hồ sơ | FR-AUTH-09 |
| PUT | `/me/password` | Đổi mật khẩu | FR-AUTH-08 |
| POST | `/me/avatar` | Tải ảnh đại diện (multipart) | FR-AUTH-09 |
| GET | `/me/enrollments` | Khóa học của tôi (`?status=IN_PROGRESS,COMPLETED`) | SCR-CRS-04 |

## 4. Khám phá khóa học (công khai)

| Method | Endpoint | Mô tả | Yêu cầu |
|--------|----------|-------|---------|
| GET | `/categories` | Cây loại khóa học đang hoạt động | FR-CRS-02 |
| GET | `/organizations` | Danh sách tổ chức đào tạo | FR-CRS-02 |
| GET | `/courses` | Tìm kiếm & lọc khóa học | FR-CRS-01..04 |
| GET | `/courses/facets` | Số lượng theo từng giá trị lọc | FR-CRS-02 |
| GET | `/courses/{slug}` | Chi tiết khóa học (+ trạng thái ghi danh nếu đăng nhập) | FR-CRS-05 |
| GET | `/courses/{slug}/lessons` | Giáo trình (+ trạng thái khóa/mở nếu đã ghi danh) | FR-CRS-06 |
| GET | `/courses/{slug}/reviews` | Danh sách đánh giá + thống kê sao | FR-CRS-07 |
| POST | `/courses/{slug}/reviews` | Viết đánh giá (USER) | FR-CRS-07 |
| PUT / DELETE | `/courses/{slug}/reviews/me` | Sửa / xóa đánh giá của tôi | FR-CRS-07 |
| POST | `/courses/{slug}/enroll` | Ghi danh (USER) | FR-CRS-09 |
| DELETE | `/courses/{slug}/enroll` | Hủy ghi danh (USER) | FR-CRS-11 |
| GET | `/courses/{slug}/ranking` | Bảng xếp hạng (`page`, `size`) | FR-RNK-01 |
| GET | `/courses/{slug}/ranking/me` | Thứ hạng của tôi | FR-RNK-02 |

Tham số `GET /courses`:

| Tham số | Ví dụ | Ghi chú |
|---------|-------|---------|
| `q` | `an toan thong tin` | Không phân biệt dấu |
| `status` | `UPCOMING,OPEN,ENDED` | Trạng thái khóa học (BR-CRS-01) |
| `myStatus` | `NOT_ENROLLED,IN_PROGRESS,COMPLETED` | Chỉ khi đăng nhập |
| `category` | `ky-nang-so,an-toan-thong-tin` | Slug cấp 1 hoặc cấp 2 |
| `level` | `BASIC,INTERMEDIATE` | |
| `organization` | `12,15` | ID tổ chức |
| `sort` | `relevance` · `newest` · `popular` · `rating` · `title` | |
| `page`, `size` | `0`, `12` | |

## 5. Học tập — `/api/v1/learning` (USER, đã ghi danh)

| Method | Endpoint | Mô tả | Yêu cầu |
|--------|----------|-------|---------|
| GET | `/learning/courses/{courseId}` | Tổng quan: tiến độ, danh sách bài kèm trạng thái, `lastLessonId` | FR-LRN-01, 08, 09 |
| GET | `/learning/lessons/{lessonId}` | Nội dung + đề bài + thông tin quiz (403 nếu bị khóa) | FR-LRN-02, 03, 07 |
| POST | `/learning/lessons/{lessonId}/complete` | Đánh dấu học xong (bài không có quiz) | FR-LRN-07 |
| POST | `/learning/quizzes/{quizId}/attempts` | Bắt đầu lượt làm (hoặc trả lượt đang làm dở) | FR-LRN-04 |
| GET | `/learning/attempts/{attemptId}` | Lấy đề của lượt đang làm (không có đáp án đúng) | FR-LRN-04 |
| PUT | `/learning/attempts/{attemptId}/answers` | Lưu nháp đáp án (tùy chọn, tự động định kỳ) | FR-LRN-04 |
| POST | `/learning/attempts/{attemptId}/submit` | Nộp bài → chấm điểm, cập nhật tiến độ & xếp hạng | FR-LRN-05, FR-RNK-03 |
| GET | `/learning/attempts/{attemptId}/result` | Kết quả chi tiết | FR-LRN-05 |
| GET | `/learning/quizzes/{quizId}/attempts` | Lịch sử các lượt của tôi | FR-LRN-10 |

Ví dụ nộp bài:

```http
POST /api/v1/learning/attempts/981/submit
Authorization: Bearer ...

{
  "answers": [
    { "questionId": 301, "selectedOptionIds": [1203] },
    { "questionId": 302, "selectedOptionIds": [1207, 1209] }
  ]
}
```

```json
200 OK
{
  "attemptId": 981,
  "score": 8,
  "maxScore": 10,
  "scorePercent": 80.0,
  "passed": true,
  "durationSeconds": 245,
  "lessonCompleted": true,
  "nextLessonUnlocked": { "id": 57, "title": "Bài 4: Nhận diện lừa đảo trực tuyến" },
  "courseProgressPercent": 60,
  "courseCompleted": false,
  "ranking": { "rank": 12, "totalScore": 38, "totalDurationSeconds": 1104 }
}
```

## 6. Quản trị — `/api/v1/admin` (ADMIN)

| Method | Endpoint | Mô tả | Yêu cầu |
|--------|----------|-------|---------|
| GET | `/admin/dashboard` | Số liệu tổng quan | FR-ADM-21 |
| GET / POST | `/admin/users` | Danh sách / tạo người dùng | FR-ADM-01, 02 |
| GET / PUT / DELETE | `/admin/users/{id}` | Chi tiết / cập nhật / xóa mềm | FR-ADM-03, 04, 06 |
| POST | `/admin/users/{id}/lock` · `/unlock` | Khóa / mở khóa (`{reason}`) | FR-ADM-05 |
| POST | `/admin/users/{id}/send-reset-password` | Gửi email đặt lại mật khẩu | FR-ADM-04 |
| GET / POST | `/admin/categories` | Cây loại khóa học / tạo | FR-ADM-07, 08 |
| PUT / DELETE | `/admin/categories/{id}` | Sửa / xóa | FR-ADM-09, 10 |
| PUT | `/admin/categories/reorder` | Sắp xếp `[{id, sortOrder}]` | FR-ADM-09 |
| GET / POST | `/admin/organizations` | Danh sách / tạo | FR-ADM-11 |
| PUT / DELETE | `/admin/organizations/{id}` | Sửa / xóa | FR-ADM-11 |
| GET / POST | `/admin/courses` | Danh sách / tạo | FR-ADM-12, 13 |
| GET / PUT / DELETE | `/admin/courses/{id}` | Chi tiết / sửa / xóa | FR-ADM-13, 15 |
| POST | `/admin/courses/{id}/publish` · `/unpublish` · `/archive` · `/restore` | Đổi trạng thái xuất bản | FR-ADM-14 |
| GET / POST | `/admin/courses/{id}/lessons` | Danh sách / tạo bài học | FR-ADM-16 |
| PUT | `/admin/courses/{id}/lessons/reorder` | Sắp xếp `[{id, orderIndex}]` | FR-ADM-16 |
| GET / PUT / DELETE | `/admin/lessons/{id}` | Chi tiết / sửa / xóa bài học | FR-ADM-16 |
| PUT / DELETE | `/admin/lessons/{id}/quiz` | Tạo-cập nhật / xóa quiz (cấu hình) | FR-ADM-17 |
| GET / POST | `/admin/quizzes/{id}/questions` | Danh sách / tạo câu hỏi (kèm đáp án) | FR-ADM-17 |
| PUT / DELETE | `/admin/questions/{id}` | Sửa / xóa câu hỏi | FR-ADM-17 |
| POST | `/admin/quizzes/{id}/questions/import` | Nhập câu hỏi từ Excel/CSV | FR-ADM-17 |
| GET | `/admin/courses/{id}/enrollments` | Học viên & tiến độ (`?export=csv`) | FR-ADM-18 |
| GET | `/admin/courses/{id}/ranking` | Bảng xếp hạng đầy đủ (`?export=csv`) | FR-ADM-19 |
| POST | `/admin/courses/{id}/ranking/recalculate` | Tính lại xếp hạng (chạy nền, trả `202`) | FR-RNK-04 |
| GET | `/admin/reviews` | Danh sách đánh giá | FR-ADM-20 |
| POST | `/admin/reviews/{id}/hide` · `/show` | Ẩn / hiện đánh giá | FR-ADM-20 |
| GET | `/admin/audit-logs` | Nhật ký thao tác | FR-ADM-22 |
| POST | `/admin/files` | Tải lên tệp (multipart) → `{id, url}` | FR-ADM-23 |

## 7. Giới hạn tần suất (rate limit)

| Nhóm API | Giới hạn |
|----------|----------|
| `/auth/login` | 10 yêu cầu / phút / IP |
| `/auth/register`, `/auth/resend-otp`, `/auth/forgot-password` | Theo BR-AUTH-04 |
| `/auth/verify-otp`, `/auth/forgot-password/verify` | 10 yêu cầu / phút / IP |
| API công khai khác | 120 yêu cầu / phút / IP |
| API đã đăng nhập | 300 yêu cầu / phút / người dùng |
