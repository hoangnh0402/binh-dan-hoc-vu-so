# Bình Dân Học Vụ Số

Nền tảng học trực tuyến miễn phí của Trường Đại học Sư phạm Hà Nội 2: khóa học ngắn theo từng bài, quiz cuối bài, bảng xếp hạng theo khóa học và trang quản trị.

| Thư mục | Nội dung |
|---|---|
| [docs/srs/](docs/srs/) | Đặc tả yêu cầu (SRS) |
| [docs/design-db/](docs/design-db/) | Thiết kế CSDL SQL Server |
| [docs/design-ui/](docs/design-ui/) | Thiết kế giao diện (tông đỏ trắng HPU2) |
| [backend/](backend/) | API — Spring Boot 3.5, Java 21, SQL Server, Flyway |
| [frontend/](frontend/) | Web — React 18, TypeScript, Vite, TanStack Query |
| [deploy/](deploy/) | Docker Compose cho môi trường dev (SQL Server + Mailpit) |

## Chạy trên máy dev

Cần: Docker Desktop, JDK 21+, Node.js 20+.

### 1. Hạ tầng (SQL Server + hộp thư Mailpit)

```sh
cp deploy/.env.example deploy/.env      # đổi mật khẩu nếu muốn
docker compose -f deploy/docker-compose.dev.yml --env-file deploy/.env up -d
sh deploy/init-db.sh                    # tạo database bdhvs + tài khoản bdhvs_migrator / bdhvs_app
```

Trên Git Bash (Windows) chạy `MSYS_NO_PATHCONV=1 sh deploy/init-db.sh` để Git Bash không đổi đường dẫn `/sql/...`.

Email (OTP, quên mật khẩu, nhắc hạn học) không gửi ra ngoài mà vào Mailpit: http://localhost:8025.

### 2. Backend (cổng 8081)

```powershell
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

Hoặc đóng gói rồi chạy: `.\mvnw.cmd package -DskipTests` → `java -jar target/bdhvs-api-*.jar --spring.profiles.active=dev`.

Khi khởi động, Flyway tạo schema; profile `dev` tạo thêm dữ liệu mẫu. Tài liệu API: http://localhost:8081/api/docs.

### 3. Frontend (cổng 5173)

```sh
cd frontend
npm install
npm run dev
```

Mở http://localhost:5173. Vite chuyển tiếp `/api` và `/files` sang backend.

### Tài khoản mẫu (profile dev)

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị viên | `admin@bdhvs.local` | `Admin12345` |
| Người học | `an.nguyen@example.com` (và `binh.tran`, `cuong.le`, `ha.pham`, `khang.do`, `lan.vu` @example.com) | `hocvien2026` |

Dữ liệu mẫu gồm 10 khóa học, các tổ chức đào tạo ghi "(dữ liệu mẫu)", lượt làm quiz giả lập để có bảng xếp hạng, một lượt học đã hết hạn và một lượt học sắp hết hạn (để xem cảnh báo).

Làm sạch về trạng thái ban đầu: `sh deploy/reset-dev-db.sh` (xóa và tạo lại database, xóa ảnh mẫu), rồi khởi động lại backend.

## Biến môi trường backend

| Biến | Mặc định (dev) | Ghi chú |
|---|---|---|
| `DB_HOST` | `localhost` | |
| `DB_APP_USER` / `DB_APP_PASSWORD` | `bdhvs_app` / theo `deploy/.env` | Tài khoản chạy ứng dụng (chỉ DML) |
| `DB_MIGRATOR_USER` / `DB_MIGRATOR_PASSWORD` | `bdhvs_migrator` / theo `deploy/.env` | Tài khoản Flyway (DDL) |
| `JWT_SECRET` | chuỗi dev | **Bắt buộc đổi** khi triển khai, tối thiểu 32 byte |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_AUTH`, `SMTP_STARTTLS` | Mailpit | |
| `MAIL_FROM` | `no-reply@bdhvs.local` | |
| `FRONTEND_URL`, `PUBLIC_BASE_URL` | `http://localhost:5173` | CORS và đường dẫn trong email |
| `UPLOAD_DIR` | `uploads` | Nơi lưu ảnh/tệp tải lên |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | `admin@bdhvs.local` / `Admin12345` | Tạo admin đầu tiên nếu chưa có; **đổi** khi triển khai |
| `SEED_DEMO_DATA` | `false` (profile `dev` bật) | |

Thời hạn học mặc định (21 ngày) đặt ở `app.learning.default-duration-days`; từng khóa học chỉnh trong trang quản trị.

## Khác biệt so với SRS (cần chốt trước khi lên production)

- **Truy cập CSDL**: dùng Spring `JdbcClient` với SQL viết tay theo [docs/design-db/05-truy-van-nghiep-vu.md](docs/design-db/05-truy-van-nghiep-vu.md) thay vì JPA.
- **Giới hạn tần suất** (OTP, đăng nhập): lưu trong bộ nhớ, chưa dùng Redis — chỉ đúng khi chạy một instance.
- **Lưu tệp**: lưu trên đĩa (`UPLOAD_DIR`), phục vụ qua `/files/**`; chưa dùng object storage.
- **Flyway trên Docker Desktop/WSL2**: SQL Server trong container lỗi `sp_getapplock`, nên profile `dev` bỏ khóa migration (`FlywayDevConfig`). Production không bật cờ này.
- **Chưa có**: CI/CD, cấu hình triển khai production, kiểm thử tự động trong repo.
