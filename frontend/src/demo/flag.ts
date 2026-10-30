// Cờ bật chế độ DEMO: FE tự phục vụ dữ liệu, không cần backend.
//
// Bật theo 3 cách (ưu tiên từ trên xuống):
//   1. Build/dev với biến môi trường VITE_DEMO=1  (xem .env.demo, script "dev:demo"/"build:demo").
//   2. Thêm ?demo=1 vào URL  → ghi nhớ trong localStorage (tiện bật trên bản đã deploy).
//      Tắt lại bằng ?demo=0.
//   3. Đặt sẵn localStorage['bdhvs.demo'] = '1'.

const KEY = 'bdhvs.demo';

function detect(): boolean {
  // (2) override qua URL, có nhớ lại (?demo=1 bật, ?demo=0 tắt)
  try {
    const p = new URLSearchParams(window.location.search).get('demo');
    if (p === '1' || p === 'true') localStorage.setItem(KEY, '1');
    else if (p === '0' || p === 'false') localStorage.setItem(KEY, '0');
    const v = localStorage.getItem(KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* bộ nhớ trình duyệt bị chặn */
  }
  // (1) biến môi trường lúc build
  if (import.meta.env.VITE_DEMO === '0') return false;
  if (import.meta.env.VITE_DEMO === '1') return true;
  // (0) Mặc định: bản production chưa cấu hình backend (VITE_API_TARGET) → bật demo
  //     để trang chạy độc lập, không cố gọi API không tồn tại.
  //     Khi đã có backend thật: đặt VITE_DEMO=0 hoặc cấu hình VITE_API_TARGET.
  return import.meta.env.PROD && !import.meta.env.VITE_API_TARGET;
}

export const DEMO = detect();

// Tài khoản ảo dùng sẵn cho bản demo (không có backend).
// Thực tế ở chế độ demo, mọi email/mật khẩu đều đăng nhập được;
// đây chỉ là tài khoản mẫu có tên đẹp, hiện sẵn trên trang đăng nhập.
export const DEMO_ACCOUNT = {
  email: 'hocvien@demo.vn',
  password: 'demo1234',
  fullName: 'Nguyễn Văn An',
};

// Tài khoản quản trị demo — đăng nhập vào khu vực /admin.
export const DEMO_ADMIN = {
  email: 'admin@demo.vn',
  password: 'admin1234',
  fullName: 'Quản trị viên',
};
