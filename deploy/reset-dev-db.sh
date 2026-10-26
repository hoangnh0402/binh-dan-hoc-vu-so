#!/usr/bin/env sh
# CHỈ DÙNG KHI DEV: xóa database bdhvs và tạo lại rỗng. Lần chạy backend kế tiếp sẽ migrate + nạp dữ liệu mẫu.
set -eu
cd "$(dirname "$0")"
. ./.env
docker exec bdhvs-sqlserver /opt/mssql-tools18/bin/sqlcmd -C -b -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
  -Q "IF DB_ID(N'bdhvs') IS NOT NULL BEGIN ALTER DATABASE bdhvs SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE bdhvs; END"
sh ./init-db.sh
rm -rf ../backend/uploads/seed
echo "Đã reset database dev."
