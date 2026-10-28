// Cờ bật chế độ DEMO: FE tự phục vụ dữ liệu, không cần backend.
//
// Bật theo 3 cách (ưu tiên từ trên xuống):
//   1. Build/dev với biến môi trường VITE_DEMO=1  (xem .env.demo, script "dev:demo"/"build:demo").
//   2. Thêm ?demo=1 vào URL  → ghi nhớ trong localStorage (tiện bật trên bản đã deploy).
//      Tắt lại bằng ?demo=0.
//   3. Đặt sẵn localStorage['bdhvs.demo'] = '1'.

const KEY = 'bdhvs.demo';

function detect(): boolean {
  // (2) override qua URL, có nhớ lại
  try {
    const p = new URLSearchParams(window.location.search).get('demo');
    if (p === '1' || p === 'true') localStorage.setItem(KEY, '1');
    else if (p === '0' || p === 'false') localStorage.removeItem(KEY);
    if (localStorage.getItem(KEY) === '1') return true;
  } catch {
    /* bộ nhớ trình duyệt bị chặn */
  }
  // (1) biến môi trường lúc build
  return import.meta.env.VITE_DEMO === '1';
}

export const DEMO = detect();
