# Thiết kế giao diện — Bình Dân Học Vụ Số

Bản thiết kế màn hình theo bộ SRS ([`docs/srs`](../../srs/README.md)), tông **đỏ – trắng** của Trường Đại học Sư phạm Hà Nội 2. Phong cách tham khảo từ <https://www.hpu2.edu.vn/>: thanh đỏ trên cùng, header trắng có logo trường, tiêu đề khối viết hoa màu đỏ có vạch bên trái, footer đỏ đậm có địa chỉ và liên hệ của trường.

Mỗi màn hình là một trang HTML tĩnh (khung 1440px), dùng chung token màu và component trong `assets/`. Đây là bản nguồn để đưa vào Figma: mỗi file trở thành một frame.

## Danh sách màn hình

| File | Màn hình | Mã SRS | Trạng thái minh họa |
|------|----------|--------|---------------------|
| [00-design-system.html](00-design-system.html) | Design system: logo, màu, chữ, nút, nhãn, ô nhập, thẻ khóa học | DESIGN.md, NFR-UX-08 | |
| [01-trang-chu.html](01-trang-chu.html) | Trang chủ | SCR-CRS-01, FR-CRS-10 | Khách |
| [02-danh-sach-khoa-hoc.html](02-danh-sach-khoa-hoc.html) | Danh sách & tìm kiếm khóa học, bộ lọc kết hợp | SCR-CRS-02, FR-CRS-01..04 | Đã đăng nhập, đang lọc |
| [03-chi-tiet-khoa-hoc.html](03-chi-tiet-khoa-hoc.html) | Chi tiết khóa học — tab Giáo trình | SCR-CRS-03, FR-CRS-05, 06, FR-LRN-12 | Đã ghi danh, 33%, còn 12 ngày |
| [04-dang-nhap.html](04-dang-nhap.html) | Đăng nhập | SCR-AUTH-01 | Lỗi sai mật khẩu |
| [05-nhap-otp.html](05-nhap-otp.html) | Nhập OTP xác thực email | SCR-AUTH-03 | Đang nhập mã |
| [06-trang-hoc.html](06-trang-hoc.html) | Trang học: danh sách bài + nội dung | SCR-LRN-01, FR-LRN-01..03, 07, 12 | Còn ≤ 3 ngày (cảnh báo) |
| [07-lam-quiz.html](07-lam-quiz.html) | Làm quiz | SCR-LRN-03, FR-LRN-04 | Câu nhiều đáp án, có đồng hồ |
| [08-ket-qua-quiz.html](08-ket-qua-quiz.html) | Kết quả quiz | SCR-LRN-04, FR-LRN-05 | Đạt, mở khóa bài tiếp |
| [09-khoa-hoc-cua-toi.html](09-khoa-hoc-cua-toi.html) | Khóa học của tôi | SCR-CRS-04 | Đang học / sắp hết hạn / hoàn thành / hết hạn |
| [10-bang-xep-hang.html](10-bang-xep-hang.html) | Bảng xếp hạng khóa học | FR-RNK-01, 02 | Top 3 + hạng của tôi |
| [11-admin-dashboard.html](11-admin-dashboard.html) | Dashboard quản trị | SCR-ADM-01, FR-ADM-21 | |
| [12-admin-form-khoa-hoc.html](12-admin-form-khoa-hoc.html) | Form khóa học, gồm **Thời hạn học** | SCR-ADM-06, FR-ADM-13 | Đổi thời hạn 21 → 28 ngày |
| [13-dang-ky.html](13-dang-ky.html) | Đăng ký tài khoản | SCR-AUTH-02, FR-AUTH-01 | Mật khẩu xác nhận không khớp |
| [14-quen-mat-khau.html](14-quen-mat-khau.html) | Quên mật khẩu — 3 bước trong một frame | SCR-AUTH-04, FR-AUTH-07 | Bước 2 nhập sai OTP |
| [15-ho-so.html](15-ho-so.html) | Hồ sơ cá nhân, đổi mật khẩu, quyền riêng tư, phiên đăng nhập | SCR-AUTH-05, FR-AUTH-06, 08, 09 | |
| [16-gioi-thieu-quiz.html](16-gioi-thieu-quiz.html) | Giới thiệu quiz + lịch sử làm bài | SCR-LRN-02, FR-LRN-04, 10 | Lượt 1 chưa đạt |
| [17-hoan-thanh-khoa-hoc.html](17-hoan-thanh-khoa-hoc.html) | Hoàn thành khóa học, viết đánh giá, chứng nhận (GĐ 2) | SCR-LRN-05, FR-LRN-11, FR-CRS-07, 08 | Hoàn thành trước hạn |
| [18-admin-nguoi-dung.html](18-admin-nguoi-dung.html) | Quản lý người dùng + chi tiết người dùng | SCR-ADM-02, FR-ADM-01..06 | Đủ 4 trạng thái tài khoản |
| [19-admin-loai-khoa-hoc.html](19-admin-loai-khoa-hoc.html) | Cây loại khóa học 2 cấp, kéo thả, form sửa | SCR-ADM-03, FR-ADM-07..10, BR-ADM-02..05 | Đang kéo thả; lỗi xóa loại còn khóa học |
| [20-admin-to-chuc.html](20-admin-to-chuc.html) | Tổ chức đào tạo | SCR-ADM-04, FR-ADM-11 | Có tổ chức đã tắt |
| [21-admin-bai-hoc-quiz.html](21-admin-bai-hoc-quiz.html) | Bài học + quiz builder | SCR-ADM-07, FR-ADM-16, 17 | Sửa câu nhiều đáp án đã có lượt trả lời |
| [22-admin-danh-gia.html](22-admin-danh-gia.html) | Kiểm duyệt đánh giá | SCR-ADM-08, FR-ADM-20 | Đánh giá vi phạm, đánh giá đã ẩn |
| [23-admin-nhat-ky.html](23-admin-nhat-ky.html) | Nhật ký thao tác (audit log) | SCR-ADM-09, FR-ADM-22 | Mở chi tiết trước/sau |
| [24-chi-tiet-tab-gioi-thieu.html](24-chi-tiet-tab-gioi-thieu.html) | Chi tiết khóa học — tab Giới thiệu | FR-CRS-05, BR-CRS-02 | Khách chưa đăng nhập ("Đăng ký học") |
| [25-chi-tiet-tab-danh-gia.html](25-chi-tiet-tab-danh-gia.html) | Chi tiết khóa học — tab Đánh giá | FR-CRS-07, BR-CRS-03 | Đang học, đủ điều kiện viết đánh giá |
| [26-chi-tiet-tab-chung-nhan.html](26-chi-tiet-tab-chung-nhan.html) | Chi tiết khóa học — tab Chứng nhận (điều kiện + mẫu) | FR-CRS-08 | Lượt học đã hết hạn ("Đăng ký học lại") |
| [27-chi-tiet-tab-xep-hang.html](27-chi-tiet-tab-xep-hang.html) | Chi tiết khóa học — tab Xếp hạng | FR-RNK-01, 02 | Đã hoàn thành, hạng #2 |
| [28-hop-thoai.html](28-hop-thoai.html) | 12 hộp thoại xác nhận & thông báo (người học + quản trị) | NFR-UX-05, FR-CRS-09, 11, FR-LRN-04, 12, FR-AUTH-06, FR-ADM-05, 06, 13, 14, 20, FR-RNK-04 | |
| [29-admin-tao-nguoi-dung.html](29-admin-tao-nguoi-dung.html) | Form tạo người dùng | FR-ADM-02 | Email trùng; chọn gửi email đặt mật khẩu |

Ảnh chụp từng màn hình nằm trong [`screens/`](screens/).

Nội dung (tên khóa học, người học, số liệu) là dữ liệu mẫu. Địa chỉ, điện thoại, email ở footer lấy từ website chính thức của trường.

## Xem và cập nhật

- Mở trực tiếp file `.html` bằng trình duyệt (cần Internet để tải font Be Vietnam Pro).
- Sửa màu/component dùng chung trong [`assets/styles.css`](assets/styles.css); header, footer, sidebar, icon trong [`assets/layout.js`](assets/layout.js); thẻ khóa học trong [`assets/components.js`](assets/components.js); phần đầu trang và cột phải của trang chi tiết khóa học (03, 24–27) trong [`assets/course-detail.js`](assets/course-detail.js) — mỗi tab đặt `data-state` để minh họa một trạng thái người học.
- Chụp lại ảnh sau khi sửa:

  ```bash
  pip install playwright && playwright install chromium
  python docs/design-ui/figma/render.py              # mọi màn hình
  python docs/design-ui/figma/render.py 03-chi-tiet-khoa-hoc.html
  ```

## Đưa vào Figma

Figma MCP server đã được khai báo trong [`.mcp.json`](../../../.mcp.json) ở gốc repo (`https://mcp.figma.com/mcp`). Lần đầu dùng:

1. Tải lại cửa sổ VS Code (hoặc mở phiên Claude Code mới) để nạp server `figma`.
2. Gõ `/mcp`, chọn `figma` → **Authenticate**, đăng nhập tài khoản Figma và cho phép truy cập.
3. Yêu cầu Claude đưa các màn hình trong thư mục này vào một file Figma mới. Link file Figma sẽ được ghi vào mục bên dưới.

Cách thủ công (không cần MCP): dùng plugin **html.to.design** trong Figma, nhập từng file HTML hoặc ảnh trong `screens/`.

**File Figma:** _(chưa tạo — cập nhật link sau khi đẩy lên Figma)_

## Chưa có trong bản này

- Bản di động (360px) — NFR-UX-03 yêu cầu mobile-first; nên làm tiếp cho trang học, chi tiết khóa học, quiz.
