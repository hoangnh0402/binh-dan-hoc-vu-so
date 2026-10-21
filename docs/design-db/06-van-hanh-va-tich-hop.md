# 06 — Vận hành & tích hợp

## 1. Chạy SQL Server bằng Docker

`deploy/docker-compose.dev.yml` (trích):

```yaml
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest   # production: ghim theo bản CU cụ thể, ví dụ 2022-CUxx-ubuntu-22.04
    container_name: bdhvs-sqlserver
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_PID: "Developer"            # staging/production: "Express"
      MSSQL_SA_PASSWORD: "${MSSQL_SA_PASSWORD}"
      MSSQL_COLLATION: "Vietnamese_100_CI_AS"
      TZ: "Etc/UTC"
    ports:
      - "1433:1433"
    volumes:
      - mssql-data:/var/opt/mssql
      - ./backups:/var/opt/mssql/backup
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P \"$$MSSQL_SA_PASSWORD\" -Q \"SELECT 1\" || exit 1"]
      interval: 10s
      retries: 10

volumes:
  mssql-data:
```

- Lần đầu chạy: thực thi script [04 §1](04-script-tao-csdl.md#1-tạo-database--tài-khoản-chạy-một-lần) để tạo database `bdhvs` và 2 tài khoản `bdhvs_migrator`, `bdhvs_app`.
- Image SQL Server trên Linux yêu cầu tối thiểu **2 GB RAM** cho container.
- Không mở cổng 1433 ra Internet ở staging/production. Chỉ backend trong cùng mạng Docker được kết nối.

## 2. Tích hợp Spring Boot

### 2.1 Thư viện (Maven)

```xml
<dependency>
    <groupId>com.microsoft.sqlserver</groupId>
    <artifactId>mssql-jdbc</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-sqlserver</artifactId>   <!-- bắt buộc với Flyway 10+ -->
</dependency>
```

Phiên bản do Spring Boot BOM quản lý.

### 2.2 Cấu hình `application.yml`

```yaml
spring:
  datasource:
    url: jdbc:sqlserver://${DB_HOST:localhost}:1433;databaseName=bdhvs;encrypt=true;trustServerCertificate=${DB_TRUST_CERT:true};applicationName=bdhvs-api
    username: ${DB_APP_USER:bdhvs_app}
    password: ${DB_APP_PASSWORD}
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 10000
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate              # schema chỉ do Flyway quản lý
    properties:
      hibernate:
        jdbc:
          time_zone: UTC
          batch_size: 50
        order_inserts: true
        order_updates: true
  flyway:
    enabled: true
    locations: classpath:db/migration
    user: ${DB_MIGRATOR_USER:bdhvs_migrator}
    password: ${DB_MIGRATOR_PASSWORD}
    validate-on-migrate: true
    baseline-on-migrate: false
```

- `trustServerCertificate=true` chỉ dùng cho dev. Ở production, cài chứng chỉ TLS cho SQL Server và đặt `false`.
- **Không** đặt `sendStringParametersAsUnicode=false`, vì mọi cột chuỗi đã là `NVARCHAR` ([01 §4](01-quy-uoc-va-kieu-du-lieu.md#4-ánh-xạ-kiểu-dữ-liệu)).

### 2.3 Ghi chú ánh xạ JPA

| Vấn đề | Cách xử lý |
|--------|-----------|
| Khóa chính `IDENTITY` | `@GeneratedValue(strategy = GenerationType.IDENTITY)`. Lưu ý: Hibernate không gộp batch INSERT được với IDENTITY. Chấp nhận được vì không có luồng ghi hàng loạt lớn |
| `DATETIME2(3)` UTC | Kiểu `Instant` + `hibernate.jdbc.time_zone=UTC` |
| `BIT` | `boolean` |
| `DECIMAL` | `BigDecimal` |
| Enum | `@Enumerated(EnumType.STRING)`, tên hằng trùng giá trị trong CHECK |
| JSON (`certificate_criteria`, `question_order`, `before_data`...) | `String`, hoặc `AttributeConverter` dùng Jackson |
| `version` | `@Version private int version;` |
| `course_categories.depth/parent_depth`, `courses.category_depth` | Gán trong constructor/factory method của entity. `category_depth` có thể `@Column(updatable = false)` cố định = 2 |
| Bảng nối `quiz_attempt_answer_options` | `@ElementCollection` (`Set<Long> optionIds`) hoặc entity riêng có `@IdClass` |
| Truy vấn xếp hạng, mở khóa bài, tìm kiếm động | Native query ([05](05-truy-van-nghiep-vu.md)) hoặc JPA Criteria/QueryDSL |
| Xóa mềm user | `@SQLRestriction("deleted_at IS NULL")` trên entity `User` (Hibernate 6.3+) |

### 2.4 Kiểm thử tích hợp (Testcontainers)

```java
@Container
static MSSQLServerContainer<?> mssql =
        new MSSQLServerContainer<>("mcr.microsoft.com/mssql/server:2022-latest")
                .acceptLicense();
```

- Flyway chạy toàn bộ migration lên container trước khi test, nên schema thật được kiểm tra trong CI.
- Pipeline CI trong SRS [10](../srs/10-quy-trinh-git-cicd.md) đã dùng "Testcontainers SQL Server".

## 3. Quy trình thay đổi schema

1. Mỗi thay đổi là một file mới `V<số>__<mo_ta>.sql`, ví dụ `V3__add_certificates.sql`. **Không sửa** file migration đã chạy trên staging/production.
2. Đặt tên constraint/index tường minh theo [01 §3](01-quy-uoc-va-kieu-du-lieu.md#3-quy-ước-đặt-tên).
3. Thay đổi phải tương thích ngược ít nhất một phiên bản ứng dụng để có thể rollback ([SRS 10 §3.4](../srs/10-quy-trinh-git-cicd.md)):
   - Thêm cột: `NULL` hoặc có `DEFAULT`.
   - Đổi tên/xóa cột: làm qua 2 lần phát hành (thêm cột mới và ghi song song → phát hành sau mới xóa cột cũ).
4. Thêm chỉ mục trên bảng lớn: Express **không** hỗ trợ `ONLINE = ON`, nên chạy vào giờ thấp điểm.
5. Mỗi PR có migration phải cập nhật [02-tu-dien-du-lieu.md](02-tu-dien-du-lieu.md) và [erd-chi-tiet.mmd](erd-chi-tiet.mmd).

## 4. Sao lưu & khôi phục

Express **không có SQL Server Agent**, nên lịch sao lưu chạy bằng cron/systemd timer trên máy chủ, gọi `sqlcmd` (hoặc `docker exec`).

| Loại | Tần suất | Lưu giữ | Mục tiêu |
|------|----------|---------|----------|
| Full backup | Hằng ngày 02:00 (giờ VN) | 30 ngày | |
| Transaction log backup | Mỗi 15 phút | 7 ngày | RPO ≤ 15 phút (NFR-REL-02) |
| Bản sao ngoài máy chủ | Sau mỗi lần backup | Theo lưu giữ trên | Đồng bộ lên object storage khác vùng |
| Thử khôi phục | Hằng quý | | RTO ≤ 4 giờ |
| Trước mỗi lần deploy production | Mỗi lần | 7 ngày | Bước trong `deploy-prod.yml` |

```bash
# /opt/bdhvs/backup-full.sh
TS=$(date -u +%Y%m%dT%H%M%SZ)
docker exec bdhvs-sqlserver /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -Q \
  "BACKUP DATABASE bdhvs TO DISK = N'/var/opt/mssql/backup/bdhvs_full_${TS}.bak' WITH CHECKSUM, INIT"
gzip /opt/bdhvs/backups/bdhvs_full_${TS}.bak        # Express không hỗ trợ backup compression
# đẩy file .gz lên object storage, xóa bản cũ hơn 30 ngày

# /opt/bdhvs/backup-log.sh  (cron: */15 * * * *)
docker exec bdhvs-sqlserver /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -Q \
  "BACKUP LOG bdhvs TO DISK = N'/var/opt/mssql/backup/bdhvs_log_${TS}.trn' WITH CHECKSUM, INIT"
```

Khôi phục về một thời điểm:

```sql
RESTORE DATABASE bdhvs FROM DISK = N'.../bdhvs_full_20261101T190000Z.bak' WITH NORECOVERY, REPLACE;
RESTORE LOG bdhvs FROM DISK = N'.../bdhvs_log_20261101T191500Z.trn' WITH NORECOVERY;
-- ... các file log tiếp theo theo thứ tự
RESTORE LOG bdhvs FROM DISK = N'.../bdhvs_log_20261101T201500Z.trn' WITH STOPAT = N'2026-11-01T20:07:00', RECOVERY;
```

> Ở recovery model `FULL`, nếu backup log ngừng chạy thì file log sẽ phình liên tục. Cần giám sát dung lượng file `.ldf` (§6).

## 5. Ước tính dung lượng (năm đầu)

Giả định: 10.000 người dùng, 50 khóa học, mỗi khóa 10 bài có quiz 10 câu. Trung bình mỗi người học 2 khóa, mỗi quiz làm 2 lượt.

| Bảng | Số dòng ước tính | Dung lượng ước tính |
|------|------------------|---------------------|
| users, user_roles, tokens | ~10.000 / ~50.000 | ~30 MB |
| courses, lessons (HTML) | 50 / 500 | ~50 MB |
| questions, question_options | 5.000 / 20.000 | ~10 MB |
| enrollments, lesson_progress | 20.000 / 200.000 | ~30 MB |
| quiz_attempts | 400.000 | ~80 MB |
| quiz_attempt_answers | 4.000.000 | ~300 MB |
| quiz_attempt_answer_options | ~4.500.000 | ~200 MB |
| rankings, quiz_best_attempts | 20.000 / 200.000 | ~30 MB |
| audit_logs | ~100.000 | ~200 MB |
| Chỉ mục | | ~40% dữ liệu |
| **Tổng** | | **≈ 1.2–1.5 GB**, dưới giới hạn 10 GB của Express |

**Nếu gần chạm 10 GB:** (1) lưu trữ hoặc xóa `quiz_attempt_answers` của các lượt không phải lượt tốt nhất và cũ hơn 1 năm; (2) chuyển `audit_logs` cũ sang file lưu trữ; (3) nâng cấp lên Standard hoặc Azure SQL.

## 6. Bảo trì & giám sát

| Hạng mục | Tần suất | Cách làm |
|----------|----------|----------|
| Rebuild/reorganize chỉ mục, cập nhật thống kê | Hằng tuần (Chủ nhật 03:00) | Bộ script miễn phí *Ola Hallengren Maintenance Solution* (`IndexOptimize`) chạy bằng cron + `sqlcmd` |
| Kiểm tra toàn vẹn | Hằng tuần | `DBCC CHECKDB (bdhvs) WITH NO_INFOMSGS;` |
| Dung lượng database | Hằng ngày | Cảnh báo khi file dữ liệu > **8 GB** (80% giới hạn Express) |
| Dung lượng file log | Hằng giờ | Cảnh báo khi `.ldf` tăng bất thường (backup log có thể đã ngừng chạy) |
| Truy vấn chậm | Liên tục | Bật **Query Store** (`ALTER DATABASE bdhvs SET QUERY_STORE = ON;`), xem các truy vấn có thời gian chạy cao nhất hằng tuần |
| Chờ khóa (blocking) | Liên tục | Theo dõi `sys.dm_exec_requests` có `blocking_session_id > 0`; RCSI đã giảm phần lớn trường hợp |

Truy vấn kiểm tra dung lượng:

```sql
SELECT name, type_desc, size * 8 / 1024 AS size_mb
FROM sys.database_files;

SELECT TOP (10) t.name AS table_name,
       SUM(a.used_pages) * 8 / 1024 AS used_mb,
       SUM(CASE WHEN i.index_id IN (0,1) THEN p.rows END) AS row_count
FROM sys.tables t
JOIN sys.indexes i          ON i.object_id = t.object_id
JOIN sys.partitions p       ON p.object_id = i.object_id AND p.index_id = i.index_id
JOIN sys.allocation_units a ON a.container_id = p.partition_id
GROUP BY t.name
ORDER BY used_mb DESC;
```

## 7. Bảo mật CSDL

| Mục | Biện pháp |
|-----|-----------|
| Tài khoản | Ứng dụng dùng `bdhvs_app` (chỉ đọc/ghi dữ liệu). Flyway dùng `bdhvs_migrator`. Không dùng `sa` trong ứng dụng |
| Mạng | Cổng 1433 chỉ mở trong mạng nội bộ Docker/VPC |
| Mã hóa đường truyền | `encrypt=true` với chứng chỉ hợp lệ ở production |
| Dữ liệu nhạy cảm | Mật khẩu, OTP, token chỉ lưu dạng hash. `audit_logs` không ghi `password_hash` |
| Bản sao lưu | Lưu trên storage có mã hóa và phân quyền truy cập riêng. Express không hỗ trợ backup encryption, nên mã hóa file sau khi backup (ví dụ `gpg`/`age`) |
| Dữ liệu cá nhân (NĐ 13/2023) | Khi xử lý yêu cầu xóa tài khoản: đặt `deleted_at`, ẩn danh hóa `email`, `full_name`, `phone`, `hometown`, `workplace`, `birth_year`, `avatar_url`; giữ lại dữ liệu học tập ở dạng ẩn danh để thống kê |
