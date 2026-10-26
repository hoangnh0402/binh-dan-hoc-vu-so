# 09 — Yêu cầu phi chức năng

Các con số dưới đây dựa trên giả định quy mô tại Q-11 ([00-tong-quan.md](00-tong-quan.md)): 10.000 người dùng đăng ký, 500 người dùng đồng thời trong năm đầu.

## 1. Hiệu năng

| Mã | Yêu cầu |
|----|---------|
| NFR-PERF-01 | API tìm kiếm/lọc khóa học: p95 ≤ 500 ms với 10.000 khóa học và 500 người dùng đồng thời. |
| NFR-PERF-02 | API nộp quiz (chấm điểm + cập nhật tiến độ + xếp hạng): p95 ≤ 800 ms. |
| NFR-PERF-03 | Các API khác: p95 ≤ 300 ms. |
| NFR-PERF-04 | Trang đầu tiên tải trên mạng 4G: Largest Contentful Paint ≤ 2,5 s; bundle JS ban đầu ≤ 300 KB (gzip) nhờ chia nhỏ theo route (code splitting). |
| NFR-PERF-05 | Ảnh được nén, phục vụ định dạng WebP và lazy-load; có kích thước thu nhỏ cho thẻ khóa học. |

## 2. Bảo mật

| Mã | Yêu cầu |
|----|---------|
| NFR-SEC-01 | Toàn bộ lưu lượng qua HTTPS (TLS 1.2+), bật HSTS. |
| NFR-SEC-02 | Mật khẩu băm BCrypt (cost ≥ 10); OTP, refresh token, reset token lưu dạng hash. |
| NFR-SEC-03 | Phòng chống OWASP Top 10: truy vấn tham số hóa (chống SQL injection), sanitize HTML nội dung do Admin nhập (chống XSS), kiểm tra quyền sở hữu dữ liệu ở mọi API (chống IDOR), CORS chỉ cho phép domain frontend. |
| NFR-SEC-04 | Header bảo mật: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`. |
| NFR-SEC-05 | Rate limit theo [08-dac-ta-api.md](08-dac-ta-api.md) mục 7; khóa tạm tài khoản theo BR-AUTH-05. |
| NFR-SEC-06 | Không ghi log mật khẩu, OTP, token, nội dung header `Authorization`. |
| NFR-SEC-07 | Bí mật cấu hình chỉ nằm trong biến môi trường / GitHub Secrets; quét bí mật trong CI (gitleaks). |
| NFR-SEC-08 | Quét lỗ hổng thư viện phụ thuộc trong CI (Dependabot / OWASP Dependency-Check / `npm audit`); không release khi còn lỗ hổng mức Critical. |
| NFR-SEC-09 | Tệp tải lên: kiểm tra loại theo nội dung, giới hạn dung lượng, đặt tên ngẫu nhiên, phục vụ từ domain/bucket tách biệt. |

## 3. Bảo vệ dữ liệu cá nhân (pháp lý)

| Mã | Yêu cầu |
|----|---------|
| NFR-PRV-01 | Tuân thủ Nghị định 13/2023/NĐ-CP: có trang Chính sách bảo vệ dữ liệu cá nhân; thu thập sự đồng ý khi đăng ký (checkbox, lưu thời điểm đồng ý). |
| NFR-PRV-02 | Chỉ thu thập dữ liệu cần thiết; các trường năm sinh, quê quán, nơi công tác, số điện thoại là tùy chọn. |
| NFR-PRV-03 | Người dùng có thể yêu cầu xóa tài khoản (gửi yêu cầu → Admin xử lý ở MVP; tự xóa ở Giai đoạn 2). |
| NFR-PRV-04 | Bảng xếp hạng công khai chỉ hiện tên rút gọn và cho phép ẩn danh (FR-RNK-01). |
| NFR-PRV-05 | Dữ liệu học tập của lượt ghi danh hết thời hạn học bị **xóa cứng** (không xóa mềm) theo BR-LRN-10; Chính sách dữ liệu cá nhân và màn hình ghi danh phải nêu rõ điều này. |

## 4. Khả năng sử dụng & truy cập

Người dùng mục tiêu gồm nhiều người lớn tuổi, ít kinh nghiệm công nghệ.

| Mã | Yêu cầu |
|----|---------|
| NFR-UX-01 | Đáp ứng chuẩn WCAG 2.1 mức AA: độ tương phản ≥ 4.5:1, điều hướng được bằng bàn phím, có nhãn cho mọi trường nhập, `alt` cho ảnh. |
| NFR-UX-02 | Cỡ chữ nội dung tối thiểu 16px; vùng bấm tối thiểu 44×44px; có nút tăng cỡ chữ ở trang học. |
| NFR-UX-03 | Responsive, ưu tiên di động (mobile-first): hỗ trợ màn hình từ 360px. |
| NFR-UX-04 | Thông báo lỗi bằng tiếng Việt dễ hiểu, nói rõ cách khắc phục; không hiển thị lỗi kỹ thuật cho người dùng. |
| NFR-UX-05 | Hộp thoại xác nhận cho các thao tác không hoàn tác được. |
| NFR-UX-06 | Trình duyệt hỗ trợ: 2 phiên bản mới nhất của Chrome, Edge, Firefox, Safari (macOS/iOS), Chrome Android, Cốc Cốc. |
| NFR-UX-07 | Hỗ trợ SEO cho trang công khai (danh sách & chi tiết khóa học): thẻ meta, Open Graph, sitemap, URL thân thiện có slug tiếng Việt không dấu. Nếu cần SEO mạnh hơn, cân nhắc chuyển trang công khai sang SSR (Next.js) ở Giai đoạn 2. |
| NFR-UX-08 | Nhận diện Trường ĐHSP Hà Nội 2: logo trường ở header (cao 40px trên desktop, 32px trên di động), footer, favicon (32×32, 180×180 cho iOS), ảnh Open Graph và email. Tông màu **đỏ – trắng**: màu chủ đạo `#962521` cho header, nút chính, liên kết, tab đang chọn; nền trắng. Chữ trắng trên nền `#962521` đạt tương phản 8,1:1. Màu lỗi luôn đi kèm biểu tượng và chữ để không nhầm với màu thương hiệu. Bảng màu tại `docs/design-ui/.../DESIGN.md`. |

## 5. Độ tin cậy & vận hành

| Mã | Yêu cầu |
|----|---------|
| NFR-REL-01 | Thời gian hoạt động (uptime) ≥ 99,5%/tháng (trừ bảo trì có thông báo trước). |
| NFR-REL-02 | Sao lưu CSDL hằng ngày, RPO ≤ 15 phút, RTO ≤ 4 giờ; kiểm tra khôi phục bản sao lưu mỗi quý. |
| NFR-REL-03 | Triển khai không gián đoạn hoặc gián đoạn ≤ 1 phút; có khả năng rollback về phiên bản trước trong ≤ 15 phút. |
| NFR-REL-04 | Log có cấu trúc (JSON) kèm `traceId`; lưu ≥ 30 ngày. |
| NFR-REL-05 | Giám sát: health check (`/actuator/health`), cảnh báo khi tỉ lệ lỗi 5xx > 1% trong 5 phút, CPU/RAM > 85%, ổ đĩa > 80%, gửi email/OTP thất bại liên tục. |
| NFR-REL-06 | Gửi email bất đồng bộ, có thử lại (retry) tối đa 3 lần; không làm chậm API đăng ký. |
| NFR-REL-07 | Thao tác nộp quiz và ghi danh phải idempotent (bấm nhiều lần không tạo dữ liệu trùng). |

## 6. Khả năng bảo trì

| Mã | Yêu cầu |
|----|---------|
| NFR-MNT-01 | Độ phủ kiểm thử đơn vị tầng service backend ≥ 70%; các quy tắc nghiệp vụ BR-LRN-*, BR-RNK-*, BR-AUTH-* bắt buộc có test. |
| NFR-MNT-02 | Kiểm thử E2E (Playwright) cho các luồng chính: đăng ký + OTP, đăng nhập, tìm kiếm + lọc, ghi danh, học + làm quiz + mở khóa bài tiếp, xếp hạng, Admin tạo khóa học hoàn chỉnh. |
| NFR-MNT-03 | Tuân thủ quy chuẩn code: Checkstyle/Spotless (Java), ESLint + Prettier (TypeScript); CI chặn merge khi không đạt. |
| NFR-MNT-04 | Mọi thay đổi schema qua migration Flyway; không sửa migration đã chạy trên staging/production. |
| NFR-MNT-05 | API có tài liệu OpenAPI luôn đồng bộ với mã nguồn. |

## 7. Khả năng mở rộng

| Mã | Yêu cầu |
|----|---------|
| NFR-SCL-01 | Backend stateless (không lưu session trên server) để có thể chạy nhiều instance sau load balancer. |
| NFR-SCL-02 | Thiết kế module tách biệt (auth, catalog, learning, ranking, admin) để có thể tách dịch vụ khi cần. |
| NFR-SCL-03 | Thiết kế vai trò, danh mục, tệp, thông báo cho phép bổ sung Blog, Chứng nhận, vai trò Giảng viên mà không phải thay đổi lớn cấu trúc hiện có. |
