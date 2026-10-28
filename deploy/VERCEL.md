# Triển khai frontend lên Vercel

CI/CD dùng **tích hợp Git sẵn của Vercel**: kết nối repo một lần, sau đó mỗi lần
push là Vercel tự build và deploy. Không cần GitHub Actions, không cần secrets.

- **Link production mong muốn:** https://binh-dan-hoc-vu-so.vercel.app
- Bản deploy chạy **chế độ DEMO** (frontend tự phục vụ dữ liệu, không cần backend).

---

## Thiết lập một lần

1. Vào https://vercel.com → **Add New… → Project** → Import repo `binh-dan-hoc-vu-so`.
2. Cấu hình khi import:
   - **Project Name:** `binh-dan-hoc-vu-so`  *(tên này quyết định domain → `binh-dan-hoc-vu-so.vercel.app`)*
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite *(Vercel tự nhận; đã tự lo rewrite SPA cho các route như `/khoa-hoc`, `/hoc/...`)*
   - **Build Command / Output:** để mặc định (`npm run build` → `dist`).
3. **Deploy**.

> Chế độ demo tự bật ở bản production (xem `frontend/src/demo/flag.ts`): khi chưa
> cấu hình backend, trang chạy độc lập bằng dữ liệu mẫu thay vì gọi API không tồn tại.

## Để link chính là `binh-dan-hoc-vu-so.vercel.app`

Vercel chỉ gắn domain chính cho **Production Branch**. Hiện code nằm ở nhánh
`feat/trien-khai-web`, nên:

- Vercel project → **Settings → Git → Production Branch** → đặt là nhánh đang chứa
  app (`feat/trien-khai-web`), **hoặc** merge nhánh đó vào `main`.
- Các nhánh khác sẽ ra URL xem trước dạng `binh-dan-hoc-vu-so-xxxx.vercel.app`.

## Kiểm thử bản demo tại máy

```bash
cd frontend
npm run build:demo
npm run preview        # http://localhost:4173
```

## Khi đã có backend thật

- Đặt biến môi trường `VITE_DEMO=0` trong Vercel (Settings → Environment Variables),
  và cấu hình địa chỉ API (`VITE_API_TARGET` + proxy/rewrite tới backend).
- Lúc đó bản build sẽ gọi API thật thay vì dùng dữ liệu demo.
