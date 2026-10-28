# Triển khai frontend lên Vercel (CI/CD)

Mỗi khi push lên nhánh `main` (hoặc `feat/trien-khai-web`), GitHub Actions sẽ tự
build frontend ở **chế độ DEMO** (chạy không cần backend) và deploy lên Vercel.

- **Link production:** https://binh-dan-hoc-vu-so.vercel.app
- **Workflow:** [`.github/workflows/deploy-vercel.yml`](../.github/workflows/deploy-vercel.yml)
- **Cấu hình build:** [`vercel.json`](../vercel.json) ở gốc repo
  (build `frontend` bằng `npm run build:demo`, output `frontend/dist`, rewrite SPA về `index.html`).

Workflow dùng **Vercel CLI** nên chủ động kiểm soát việc build demo, không phụ thuộc
cài đặt trên dashboard.

---

## Thiết lập một lần (bắt buộc)

Chỉ cần làm **một lần**. Sau đó mọi lần push sẽ tự động deploy.

### 1. Tạo project trên Vercel với đúng tên

Tên project quyết định link. Để ra đúng `binh-dan-hoc-vu-so.vercel.app`, project
phải tên **`binh-dan-hoc-vu-so`**.

Cách nhanh nhất bằng Vercel CLI (chạy ở **gốc repo**, máy đã cài `npm i -g vercel`):

```bash
vercel login
vercel link
# Khi được hỏi:
#   - Set up “…/binh-dan-hoc-vu-so”? → Y
#   - Which scope? → chọn tài khoản/đội của bạn
#   - Link to existing project? → N
#   - What’s your project’s name? → binh-dan-hoc-vu-so
#   - In which directory is your code located? → ./   (GIỮ GỐC REPO, KHÔNG chọn frontend)
```

> Quan trọng: **Root Directory = `./`** (gốc repo), vì `vercel.json` ở gốc đã lo việc
> build thư mục `frontend`. Nếu đặt root là `frontend`, cấu hình sẽ lệch.

Lệnh `vercel link` tạo file `.vercel/project.json` chứa `orgId` và `projectId`.

### 2. Lấy 3 giá trị để làm GitHub Secret

```bash
cat .vercel/project.json      # có "orgId" và "projectId"
```

- `VERCEL_ORG_ID`     = giá trị `orgId`
- `VERCEL_PROJECT_ID` = giá trị `projectId`
- `VERCEL_TOKEN`      = tạo tại https://vercel.com/account/tokens (Create Token)

### 3. Thêm secrets vào GitHub

Repo trên GitHub → **Settings → Secrets and variables → Actions → New repository secret**,
thêm lần lượt 3 secret ở trên (đúng tên).

### 4. Tắt auto-deploy mặc định của Vercel (khuyến nghị)

Để tránh deploy **hai lần** (một của Vercel Git, một của workflow này):
Vercel project → **Settings → Git** → tắt *Production/Preview Deployments* cho GitHub,
hoặc thêm file `.vercel/project.json`… (đã có `vercel.json` kiểm soát). Nếu để nguyên
cũng không sao, chỉ là chạy dư một bản.

### 5. Deploy lần đầu

Push bất kỳ commit nào lên nhánh được theo dõi, hoặc vào tab **Actions** của repo →
workflow *Deploy to Vercel (production)* → **Run workflow**.

---

## Chạy/deploy thủ công từ máy (không qua GitHub)

```bash
# ở gốc repo, đã `vercel link`
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

## Kiểm thử bản build demo tại máy

```bash
cd frontend
npm run build:demo
npm run preview        # mở http://localhost:4173
```

---

## Ghi chú

- Bản deploy là **chế độ DEMO**: dữ liệu khóa học do frontend tự phục vụ, lưu ở
  `localStorage` của trình duyệt. Không có backend, không có trang quản trị thật.
- Khi đã deploy backend thật và muốn site gọi API thật: đổi `buildCommand` trong
  `vercel.json` thành `npm --prefix frontend run build` và cấu hình proxy/`VITE_API_TARGET`
  trỏ tới backend.
