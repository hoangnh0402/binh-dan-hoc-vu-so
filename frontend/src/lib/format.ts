// Định dạng hiển thị theo múi giờ Việt Nam (SRS 07 §1: lưu UTC, hiển thị Asia/Ho_Chi_Minh).

const TZ = 'Asia/Ho_Chi_Minh';

export function formatDate(iso?: string | null) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${time} ngày ${formatDate(iso)}`;
}

export function formatNumber(n?: number | null) {
  return new Intl.NumberFormat('vi-VN').format(n ?? 0);
}

export function formatRating(n?: number | null) {
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(n ?? 0));
}

/** mm:ss hoặc hh:mm:ss */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatMinutes(min?: number | null) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

/** "còn 12 ngày 5 giờ" / "còn 5 giờ 20 phút" / "còn 12 phút" */
export function remaining(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'đã hết hạn';
  const min = Math.floor(ms / 60000);
  const days = Math.floor(min / 1440);
  const hours = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  if (days > 0) return hours ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  if (hours > 0) return `${hours} giờ ${mins} phút`;
  return `${Math.max(1, mins)} phút`;
}

/** Mức cảnh báo hạn học: ≤ 24 giờ đỏ, ≤ 3 ngày vàng (FR-LRN-12). */
export function deadlineLevel(iso?: string | null, now = Date.now()): 'ok' | 'warn' | 'danger' | 'expired' {
  if (!iso) return 'ok';
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'expired';
  if (ms <= 24 * 3600 * 1000) return 'danger';
  if (ms <= 3 * 24 * 3600 * 1000) return 'warn';
  return 'ok';
}

export const LEVEL_LABEL: Record<string, string> = { BASIC: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao' };
export const TIME_STATUS_LABEL: Record<string, string> = { UPCOMING: 'Sắp mở', OPEN: 'Đang mở', ENDED: 'Đã kết thúc' };
export const ENROLL_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Đang học',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
};

export function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  const first = parts[0] ?? '';
  return ((parts.length > 1 ? first[0] : '') + (last[0] ?? '')).toUpperCase();
}

export function durationLabel(days: number) {
  return days % 7 === 0 ? `${days / 7} tuần` : `${days} ngày`;
}

export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
