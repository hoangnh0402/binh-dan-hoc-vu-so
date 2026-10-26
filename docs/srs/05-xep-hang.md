# 05 — Xếp hạng (Ranking)

Nguồn: `knowledge_base/- Trang người dung.txt` — *"Xếp hạng (tính theo số điểm, nếu bằng điểm so thời gian làm bài)"*; `knowledge_base/Thiết kế DB.txt` — *"ranking: id người dùng, id khóa học, điểm"*.

## 1. Danh sách yêu cầu chức năng

| Mã | Chức năng | Tác nhân | Ưu tiên |
|----|-----------|----------|---------|
| FR-RNK-01 | Bảng xếp hạng theo từng khóa học | Khách, USER | M |
| FR-RNK-02 | Hiển thị thứ hạng của tôi | USER | M |
| FR-RNK-03 | Cập nhật xếp hạng ngay sau khi nộp quiz | Hệ thống | M |
| FR-RNK-04 | Admin xem / tính lại bảng xếp hạng | ADMIN | S |
| FR-RNK-05 | Bảng xếp hạng toàn hệ thống | Khách, USER | C (Giai đoạn 2) |

## 2. Cách tính điểm

### BR-RNK-01 — Điểm của người học trong một khóa học

Với mỗi quiz trong khóa học, lấy **lượt làm tốt nhất** của người học:

- Lượt tốt nhất = lượt có `score` **cao nhất**; nếu nhiều lượt cùng điểm → lượt có `duration_seconds` **ngắn nhất**; nếu vẫn bằng → lượt nộp **sớm nhất**.

Sau đó:

```
total_score    = Σ score của lượt tốt nhất, trên mọi quiz của khóa học
total_duration = Σ duration_seconds của chính các lượt tốt nhất đó
```

> Lựa chọn "lượt tốt nhất" thay vì "lượt đầu tiên" đang chờ xác nhận tại Q-05. Nếu đổi sang "lượt đầu tiên", chỉ cần đổi quy tắc chọn lượt; cấu trúc dữ liệu không đổi.

### BR-RNK-02 — Thứ tự xếp hạng

| Ưu tiên | Tiêu chí | Chiều |
|---------|----------|-------|
| 1 | `total_score` | Giảm dần (điểm cao hơn xếp trên) |
| 2 | `total_duration` | Tăng dần (**bằng điểm thì ai làm nhanh hơn xếp trên**) |
| 3 | `last_achieved_at` — thời điểm đạt được tổng điểm hiện tại | Tăng dần (ai đạt trước xếp trên) |

Sau cả 3 tiêu chí vẫn bằng nhau → **đồng hạng** (dùng `RANK()`; ví dụ 1, 2, 2, 4).

### BR-RNK-03 — Đối tượng được xếp hạng

- Chỉ người học có enrollment `IN_PROGRESS` hoặc `COMPLETED` và `total_score > 0`.
- Không tính tài khoản `ADMIN`, tài khoản `LOCKED` hoặc đã xóa.
- Điểm từ các lượt nộp **sau** `end_date` của khóa học không được cộng (BR-LRN-07).
- Lượt ghi danh hết thời hạn học (`EXPIRED`) bị xóa bản ghi `rankings` và `quiz_best_attempts` của khóa đó (BR-LRN-10). Khi học lại, người học bắt đầu từ 0 điểm.

### Ví dụ

| Người học | Quiz bài 1 (tốt nhất) | Quiz bài 2 (tốt nhất) | total_score | total_duration | Hạng |
|-----------|-----------------------|-----------------------|-------------|----------------|------|
| An | 10 điểm / 120s | 9 điểm / 200s | 19 | 320s | **2** |
| Bình | 10 điểm / 100s | 9 điểm / 150s | 19 | 250s | **1** |
| Chi | 8 điểm / 60s | 10 điểm / 90s | 18 | 150s | **3** |

An và Bình bằng điểm (19), Bình làm nhanh hơn (250s < 320s) nên xếp trên.

## 3. Đặc tả chi tiết

### FR-RNK-01 — Bảng xếp hạng khóa học

- Vị trí: tab/khối "Xếp hạng" trên trang chi tiết khóa học và trong trang học.
- Hiển thị Top 50, phân trang 20/trang: hạng, ảnh đại diện, tên hiển thị, tổng điểm, tổng thời gian (định dạng `mm:ss` hoặc `hh:mm:ss`), số bài đã hoàn thành.
- Top 3 có huy hiệu vàng/bạc/đồng.
- **Quyền riêng tư:** tên hiển thị dạng rút gọn cho khách (ví dụ "Nguyễn V. A."); người dùng có thể tắt hiển thị trên bảng xếp hạng trong hồ sơ (hiển thị "Học viên ẩn danh").

### FR-RNK-02 — Thứ hạng của tôi

- Người đã đăng nhập và có trong bảng xếp hạng: dòng "Hạng của bạn: #27 / 1.240 — 152 điểm — 18:20" được ghim ở đầu/cuối bảng.
- Chưa có điểm → "Hoàn thành quiz đầu tiên để có mặt trên bảng xếp hạng".

### FR-RNK-03 — Cập nhật

- Khi một lượt quiz được nộp và chấm xong, **trong cùng transaction**: cập nhật lượt tốt nhất của quiz đó (bảng `quiz_best_attempts`) và cập nhật bản ghi `rankings (user_id, course_id)` (upsert `total_score`, `total_duration_seconds`, `last_achieved_at`).
- Thứ hạng được **tính khi đọc** bằng truy vấn có chỉ mục `(course_id, total_score DESC, total_duration_seconds ASC, last_achieved_at ASC)`; có thể cache Top 50 ở Redis 60 giây khi tải lớn.

### FR-RNK-04 — Quản trị

- Admin xem bảng xếp hạng đầy đủ của khóa học, xuất CSV.
- Nút "Tính lại xếp hạng" (dùng khi sửa câu hỏi/đáp án làm sai lệch điểm): chấm lại toàn bộ lượt làm theo đáp án hiện tại và dựng lại bảng `rankings` cho khóa học — chạy nền, có thông báo khi xong.

### FR-RNK-05 — Xếp hạng toàn hệ thống (Giai đoạn 2)

- Tổng `total_score` qua mọi khóa học, phá hòa bằng tổng thời gian. Có thể lọc theo tháng.
