-- Tạo database và 2 tài khoản (docs/design-db/04 §1). Chạy một lần bằng sa:
--   deploy/init-db.sh
-- Mật khẩu truyền qua biến sqlcmd $(MIGRATOR_PASSWORD), $(APP_PASSWORD).
IF DB_ID(N'bdhvs') IS NULL
BEGIN
    CREATE DATABASE bdhvs COLLATE Vietnamese_100_CI_AS;
END;
GO
ALTER DATABASE bdhvs SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
ALTER DATABASE bdhvs SET ALLOW_SNAPSHOT_ISOLATION ON;
ALTER DATABASE bdhvs SET COMPATIBILITY_LEVEL = 160;
GO
IF SUSER_ID(N'bdhvs_migrator') IS NULL
    CREATE LOGIN bdhvs_migrator WITH PASSWORD = N'$(MIGRATOR_PASSWORD)', CHECK_POLICY = ON;
IF SUSER_ID(N'bdhvs_app') IS NULL
    CREATE LOGIN bdhvs_app WITH PASSWORD = N'$(APP_PASSWORD)', CHECK_POLICY = ON;
GO
USE bdhvs;
GO
IF USER_ID(N'bdhvs_migrator') IS NULL
BEGIN
    CREATE USER bdhvs_migrator FOR LOGIN bdhvs_migrator;
    ALTER ROLE db_owner ADD MEMBER bdhvs_migrator;
END;
IF USER_ID(N'bdhvs_app') IS NULL
BEGIN
    CREATE USER bdhvs_app FOR LOGIN bdhvs_app;
    ALTER ROLE db_datareader ADD MEMBER bdhvs_app;
    ALTER ROLE db_datawriter ADD MEMBER bdhvs_app;
END;
GO
