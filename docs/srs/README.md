# Bộ tài liệu SRS — Website "Bình Dân Học Vụ Số"

> Phiên bản: 0.2 (bản nháp) · Ngày lập: 2026-10-21 · Cập nhật: 2026-10-26 · Nguồn đầu vào: thư mục `knowledge_base/`

Bộ tài liệu đặc tả yêu cầu phần mềm (Software Requirements Specification) cho nền tảng học trực tuyến "Bình Dân Học Vụ Số". Tài liệu được chuẩn hóa từ các ghi chú ý tưởng ban đầu, bổ sung quy tắc nghiệp vụ, thiết kế dữ liệu, API, quy trình phát triển và kế hoạch triển khai.

## 1. Mục lục

| # | Tài liệu | Nội dung chính |
|---|----------|----------------|
| 00 | [Tổng quan](00-tong-quan.md) | Mục tiêu, phạm vi, tác nhân, giả định, câu hỏi mở |
| 01 | [Kiến trúc hệ thống](01-kien-truc-he-thong.md) | Công nghệ đề xuất, kiến trúc, cấu trúc mã nguồn |
| 02 | [Xác thực & phân quyền](02-xac-thuc-phan-quyen.md) | Đăng ký, đăng nhập, OTP qua email, quên mật khẩu, RBAC |
| 03 | [Khám phá khóa học](03-kham-pha-khoa-hoc.md) | Tìm kiếm, lọc kết hợp, chi tiết khóa học, đăng ký học |
| 04 | [Học tập & Quiz](04-hoc-tap-va-quiz.md) | Vào học, mở khóa bài tuần tự, làm quiz, tiến độ |
| 05 | [Xếp hạng](05-xep-hang.md) | Cách tính điểm, tiêu chí phá hòa theo thời gian |
| 06 | [Trang quản trị](06-trang-quan-tri.md) | Quản lý người dùng, loại khóa học 2 cấp, khóa học, bài học, quiz |
| 07 | [Thiết kế CSDL](07-thiet-ke-csdl.md) | ERD, bảng, ràng buộc, chỉ mục |
| 08 | [Đặc tả API](08-dac-ta-api.md) | Danh sách REST API, quy ước request/response |
| 09 | [Yêu cầu phi chức năng](09-yeu-cau-phi-chuc-nang.md) | Bảo mật, hiệu năng, khả năng truy cập, pháp lý |
| 10 | [Quy trình Git & CI/CD](10-quy-trinh-git-cicd.md) | Mô hình nhánh, quy ước đặt tên, pipeline |
| 11 | [Kế hoạch triển khai](11-ke-hoach-trien-khai.md) | Lộ trình theo giai đoạn/sprint, mốc, rủi ro |

Thứ tự đọc khuyến nghị: 00 → 02..06 (nghiệp vụ) → 07, 08 (thiết kế) → 01, 09, 10 (kỹ thuật) → 11 (kế hoạch).

## 2. Quy ước mã yêu cầu

| Tiền tố | Ý nghĩa | Ví dụ |
|---------|---------|-------|
| `FR-AUTH-xx` | Yêu cầu chức năng — Xác thực & phân quyền | FR-AUTH-01 |
| `FR-CRS-xx` | Yêu cầu chức năng — Khám phá khóa học | FR-CRS-03 |
| `FR-LRN-xx` | Yêu cầu chức năng — Học tập & Quiz | FR-LRN-05 |
| `FR-RNK-xx` | Yêu cầu chức năng — Xếp hạng | FR-RNK-01 |
| `FR-ADM-xx` | Yêu cầu chức năng — Quản trị | FR-ADM-10 |
| `BR-xx` | Quy tắc nghiệp vụ (Business Rule) | BR-LRN-02 |
| `NFR-xx` | Yêu cầu phi chức năng | NFR-SEC-01 |
| `Q-xx` | Câu hỏi mở cần chủ dự án xác nhận | Q-03 |

Mức ưu tiên (theo MoSCoW): **M** = Must (bắt buộc cho MVP), **S** = Should (nên có), **C** = Could (có thể có), **W** = Won't (chưa làm ở giai đoạn này).

## 3. Ma trận truy vết: ý tưởng gốc → yêu cầu

| Ý tưởng trong `knowledge_base/` | Yêu cầu tương ứng |
|----------------------------------|-------------------|
| Đăng nhập, đăng ký, quên mật khẩu, OTP gửi mail | FR-AUTH-01 → FR-AUTH-09 |
| Role: Admin, User | FR-AUTH-10, mục RBAC tài liệu 02 |
| Tìm kiếm khóa học theo trạng thái, lĩnh vực, trình độ, tổ chức đào tạo (kết hợp) | FR-CRS-01 → FR-CRS-04 |
| Chi tiết khóa học: giới thiệu, giáo trình, đánh giá, (chứng nhận) | FR-CRS-05 → FR-CRS-08 |
| Đăng ký học + thanh tiến độ học | FR-CRS-09, FR-LRN-08 |
| Khóa học chỉ được học 3 tuần kể từ khi bắt đầu; hết hạn thì xóa dữ liệu, đóng khóa, phải học lại; Admin cấu hình thời hạn từng khóa | FR-LRN-12, 13, BR-LRN-09 → 12, BR-CRS-06, FR-ADM-13 |
| Logo trường ĐHSP Hà Nội 2, tông màu đỏ – trắng | 00 §2.1, A-08, NFR-UX-08, `docs/design-ui` |
| Vào học: bài học, đề bài, quiz, mở khóa tuần tự | FR-LRN-01 → FR-LRN-07 |
| Xếp hạng theo điểm, bằng điểm so thời gian làm bài | FR-RNK-01 → FR-RNK-05 |
| Blog (mở rộng) | Giai đoạn 3 — tài liệu 11 |
| Quản lý người dùng (CRUD) | FR-ADM-01 → FR-ADM-06 |
| Quản lý loại khóa học (có loại con) | FR-ADM-07 → FR-ADM-10 |
| Quản lý khóa học (kèm tổ chức đào tạo, bài học, quiz) | FR-ADM-11 → FR-ADM-20 |
| Thiết kế DB: người dùng, role, loại khóa học 2 cấp, khóa học, ranking, bài học | Tài liệu 07 |
| Workflow GitHub: main / develop / feat / fix, CI/CD | Tài liệu 10 |

## 4. Lịch sử thay đổi

| Phiên bản | Ngày | Nội dung |
|-----------|------|----------|
| 0.1 | 2026-10-21 | Bản nháp đầu tiên, chuẩn hóa từ knowledge base |
| 0.2 | 2026-10-26 | Thêm **thời hạn học** cho mỗi lượt ghi danh (mặc định 21 ngày, Admin cấu hình theo khóa; hết hạn thì đóng khóa, xóa dữ liệu học tập, học lại từ đầu) — cập nhật 00, 03–09, 11 và `docs/design-db`. Thêm nhận diện Trường ĐHSP Hà Nội 2: logo, tông đỏ – trắng `#962521` (00, 09, `docs/design-ui`). Thêm Q-12, Q-13 |
