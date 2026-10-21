# 03 — Khám phá khóa học (Tìm kiếm, chi tiết, đăng ký học)

Nguồn: `knowledge_base/- Trang người dung.txt`.

## 1. Danh sách yêu cầu chức năng

| Mã | Chức năng | Tác nhân | Ưu tiên |
|----|-----------|----------|---------|
| FR-CRS-01 | Tìm kiếm khóa học theo từ khóa | Khách, USER | M |
| FR-CRS-02 | Lọc kết hợp: trạng thái, lĩnh vực (loại cấp 1/cấp 2), trình độ, tổ chức đào tạo | Khách, USER | M |
| FR-CRS-03 | Sắp xếp kết quả | Khách, USER | M |
| FR-CRS-04 | Phân trang kết quả, giữ bộ lọc trên URL | Khách, USER | M |
| FR-CRS-05 | Chi tiết khóa học — tab Giới thiệu | Khách, USER | M |
| FR-CRS-06 | Chi tiết khóa học — tab Giáo trình | Khách, USER | M |
| FR-CRS-07 | Chi tiết khóa học — tab Đánh giá (xem & viết) | Khách (xem), USER (viết) | S |
| FR-CRS-08 | Chi tiết khóa học — tab Chứng nhận | Khách, USER | C (thông tin ở MVP, cấp chứng nhận ở GĐ 2) |
| FR-CRS-09 | Đăng ký học (ghi danh) | USER | M |
| FR-CRS-10 | Trang chủ: khóa học nổi bật, mới nhất, danh mục lĩnh vực | Khách, USER | S |
| FR-CRS-11 | Hủy ghi danh khóa học | USER | C |

## 2. Đặc tả chi tiết

### FR-CRS-01 — Tìm kiếm theo từ khóa

- Ô tìm kiếm trên thanh điều hướng và trên trang danh sách khóa học.
- Tìm trong: tên khóa học, mô tả ngắn, tên tổ chức đào tạo.
- **Không phân biệt dấu và hoa thường**: "an toan thong tin" phải tìm thấy "An toàn thông tin" (dùng cột `search_text` đã chuẩn hóa không dấu — xem [design-db/01 §5](../design-db/01-quy-uoc-va-kieu-du-lieu.md#5-tìm-kiếm-tiếng-việt-không-dấu)).
- Từ khóa tối đa 100 ký tự; bỏ khoảng trắng thừa.
- Chỉ trả về khóa học ở trạng thái xuất bản `PUBLISHED`.

### FR-CRS-02 — Bộ lọc kết hợp

Các điều kiện có thể dùng **đồng thời**; giữa các nhóm là phép **VÀ**, trong cùng một nhóm cho phép chọn nhiều giá trị là phép **HOẶC**.

| Bộ lọc | Giá trị | Kiểu chọn |
|--------|---------|-----------|
| Trạng thái khóa học | Sắp mở · Đang mở · Đã kết thúc | Nhiều |
| Trạng thái học của tôi *(chỉ khi đăng nhập)* | Chưa đăng ký · Đang học · Đã hoàn thành | Nhiều |
| Lĩnh vực | Cây loại khóa học 2 cấp; chọn cấp 1 ⇒ bao gồm mọi cấp 2 con | Nhiều |
| Trình độ | Cơ bản · Trung cấp · Nâng cao | Nhiều |
| Tổ chức đào tạo | Danh sách tổ chức (có ô tìm nhanh) | Nhiều |

Ví dụ: *Lĩnh vực = Kỹ năng số* **VÀ** *Trình độ ∈ {Cơ bản, Trung cấp}* **VÀ** *Trạng thái = Đang mở*.

**Quy tắc xác định trạng thái khóa học** (BR-CRS-01), tính theo thời điểm hiện tại:

| Trạng thái | Điều kiện |
|------------|-----------|
| Sắp mở | `start_date` > hiện tại |
| Đang mở | (`start_date` rỗng hoặc ≤ hiện tại) **và** (`end_date` rỗng hoặc ≥ hiện tại) |
| Đã kết thúc | `end_date` < hiện tại |

> Khóa học không đặt ngày bắt đầu/kết thúc được coi là "Đang mở" vô thời hạn.

- Bên cạnh mỗi giá trị lọc hiển thị số lượng khóa học tương ứng (facet count) — ưu tiên S.
- Nút "Xóa bộ lọc" đưa về trạng thái mặc định.
- Trên di động, bộ lọc hiển thị trong ngăn kéo (drawer) với nút "Áp dụng".

### FR-CRS-03 — Sắp xếp

Phù hợp nhất (mặc định khi có từ khóa) · Mới nhất (mặc định khi không có từ khóa) · Nhiều người học nhất · Đánh giá cao nhất · Tên A→Z.

### FR-CRS-04 — Phân trang & URL

- 12 khóa học/trang (lưới thẻ), tối đa 50 khi gọi API.
- Toàn bộ điều kiện tìm kiếm phản ánh trên query string, ví dụ:
  `/khoa-hoc?q=excel&category=ky-nang-so&level=BASIC,INTERMEDIATE&status=OPEN&org=12&sort=newest&page=2`
  → người dùng có thể chia sẻ link và giữ được kết quả khi tải lại trang / nhấn Back.

**Thẻ khóa học (course card)** hiển thị: ảnh bìa, tên, tổ chức đào tạo, lĩnh vực, trình độ, số bài học, thời lượng ước tính, số người học, điểm đánh giá trung bình, nhãn trạng thái; nếu đã đăng nhập và đã ghi danh → thanh tiến độ nhỏ.

### FR-CRS-05 — Tab Giới thiệu

- Phần đầu trang (luôn hiển thị): ảnh bìa, tên khóa học, tổ chức đào tạo (logo + tên), lĩnh vực (cấp 1 › cấp 2), trình độ, trạng thái, thời gian mở/kết thúc, số bài học, thời lượng ước tính, số người học, đánh giá trung bình.
- Nút hành động (xem BR-CRS-02):
  - Khách → "Đăng ký học" (chuyển đến đăng nhập, sau đó quay lại).
  - USER chưa ghi danh → "Đăng ký học".
  - USER đã ghi danh → thanh tiến độ + "Tiếp tục học" (đến bài đang học dở).
  - USER đã hoàn thành → "Xem lại khóa học".
- Nội dung tab: mô tả chi tiết (rich text), mục tiêu đầu ra, đối tượng phù hợp, yêu cầu đầu vào.

### FR-CRS-06 — Tab Giáo trình

- Danh sách bài học theo thứ tự: số thứ tự, tên bài, thời lượng ước tính, có quiz hay không.
- Biểu tượng trạng thái với người đã ghi danh: ✅ đã hoàn thành · ▶️ đang học / đã mở khóa · 🔒 bị khóa.
- Khách và người chưa ghi danh chỉ xem được tên bài, **không** mở được nội dung bài.

### FR-CRS-07 — Tab Đánh giá

- Hiển thị: điểm trung bình (1–5 sao), phân bố số đánh giá theo số sao, danh sách nhận xét (tên người viết, số sao, nội dung, ngày) mới nhất trước, phân trang 10/trang.
- Viết đánh giá (BR-CRS-03): người học đã ghi danh và **hoàn thành ít nhất 1 bài học**; mỗi người 1 đánh giá/khóa, được sửa hoặc xóa đánh giá của mình.
- Nội dung nhận xét 0–1000 ký tự; số sao bắt buộc.
- Admin có thể ẩn đánh giá vi phạm (tài liệu 06).

### FR-CRS-08 — Tab Chứng nhận

- MVP: hiển thị điều kiện để được cấp chứng nhận (ví dụ: hoàn thành 100% bài học, điểm quiz trung bình ≥ 70%) và ảnh mẫu chứng nhận.
- Giai đoạn 2: người học đủ điều kiện tải chứng nhận PDF có mã xác minh; trang công khai tra cứu mã chứng nhận.

### FR-CRS-09 — Đăng ký học

1. USER nhấn "Đăng ký học".
2. Hệ thống kiểm tra BR-CRS-02.
3. Tạo bản ghi `enrollment` trạng thái `IN_PROGRESS`, tiến độ 0%, bài học thứ nhất được mở khóa.
4. Hiển thị thông báo thành công, nút đổi thành "Vào học" và **thanh tiến độ học** xuất hiện (cũng hiển thị ở trang "Khóa học của tôi").
5. Ghi danh lặp lại (bấm 2 lần) không tạo bản ghi trùng (ràng buộc duy nhất `user_id + course_id`).

### FR-CRS-11 — Hủy ghi danh

- USER có thể hủy ghi danh khóa đang học; hệ thống hỏi xác nhận.
- Khi hủy: enrollment chuyển `CANCELLED`, ẩn khỏi bảng xếp hạng; nếu đăng ký lại sẽ **khôi phục** tiến độ cũ.

## 3. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|----|---------|
| BR-CRS-01 | Trạng thái khóa học (Sắp mở / Đang mở / Đã kết thúc) được **tính** từ ngày bắt đầu/kết thúc, không lưu cứng. |
| BR-CRS-02 | Chỉ được ghi danh khi khóa học `PUBLISHED` và đang ở trạng thái "Đang mở". Khóa "Sắp mở" cho phép ghi danh trước nhưng chỉ vào học khi đến `start_date`. Khóa "Đã kết thúc": người đã ghi danh vẫn được xem lại nội dung, không nhận ghi danh mới. |
| BR-CRS-03 | Chỉ người đã ghi danh và hoàn thành ≥ 1 bài học được viết đánh giá; mỗi người tối đa 1 đánh giá cho mỗi khóa. |
| BR-CRS-04 | Khóa học `DRAFT` / `ARCHIVED` không xuất hiện trong tìm kiếm và trả `404` khi truy cập trực tiếp (trừ Admin). |
| BR-CRS-05 | Điểm đánh giá trung bình và số người học được tính lại khi có thay đổi (lưu cột tổng hợp trên bảng `courses` để truy vấn nhanh). |

## 4. Màn hình

| Mã | Màn hình | Đường dẫn |
|----|----------|-----------|
| SCR-CRS-01 | Trang chủ | `/` |
| SCR-CRS-02 | Danh sách & tìm kiếm khóa học | `/khoa-hoc` |
| SCR-CRS-03 | Chi tiết khóa học (4 tab) | `/khoa-hoc/:slug` |
| SCR-CRS-04 | Khóa học của tôi (lọc: đang học / đã hoàn thành) | `/toi/khoa-hoc` |

### Phác thảo trang danh sách

```
┌───────────────────────────────────────────────────────────────┐
│ LOGO   [ Tìm khóa học...                     🔍 ]  Đăng nhập  │
├──────────────┬────────────────────────────────────────────────┤
│ BỘ LỌC       │ 128 khóa học           Sắp xếp: [Mới nhất ▾]   │
│ Trạng thái   │ ┌────────┐ ┌────────┐ ┌────────┐               │
│ ☐ Sắp mở     │ │  ảnh   │ │  ảnh   │ │  ảnh   │               │
│ ☑ Đang mở    │ │ Tên KH │ │ Tên KH │ │ Tên KH │               │
│ Lĩnh vực     │ │ Tổ chức│ │ Tổ chức│ │ Tổ chức│               │
│ ▸ Kỹ năng số │ │ ★4.6   │ │ ★4.2   │ │ ★4.8   │               │
│ Trình độ     │ └────────┘ └────────┘ └────────┘               │
│ Tổ chức      │            « 1 2 3 ... 11 »                    │
│ [Xóa bộ lọc] │                                                │
└──────────────┴────────────────────────────────────────────────┘
```
