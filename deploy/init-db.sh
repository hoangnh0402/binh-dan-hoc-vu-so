#!/usr/bin/env sh
# Khởi tạo database bdhvs và tài khoản migrator/app trong container SQL Server dev.
set -eu
cd "$(dirname "$0")"
. ./.env
docker exec bdhvs-sqlserver /opt/mssql-tools18/bin/sqlcmd -C -b -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
  -v MIGRATOR_PASSWORD="$DB_MIGRATOR_PASSWORD" APP_PASSWORD="$DB_APP_PASSWORD" \
  -i /sql/00-create-database.sql
echo "Database bdhvs đã sẵn sàng."
