-- Sinh từ docs/design-db/04-script-tao-csdl.md. Sửa tài liệu thiết kế trước, rồi tạo migration mới (không sửa file đã chạy).
SET IDENTITY_INSERT dbo.roles ON;
INSERT INTO dbo.roles (id, code, name) VALUES
    (1, N'ADMIN', N'Quản trị viên'),
    (2, N'USER',  N'Người học');
SET IDENTITY_INSERT dbo.roles OFF;
GO
