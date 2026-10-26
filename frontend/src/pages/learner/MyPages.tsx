import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/api/client';
import type { CourseCard as Card, Page, Profile, RankingRow } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Icon } from '@/components/Icon';
import { CardGridSkeleton, CourseCard, Thumb } from '@/components/CourseCard';
import { Avatar } from '@/components/Layout';
import { Empty, ErrorBox, Field, Pager, PasswordInput, Progress, Spinner, Toggle, errorMessage, useConfirm, useToast } from '@/components/ui';
import { deadlineLevel, formatClock, formatDate, formatNumber, remaining } from '@/lib/format';
import { RankingTable } from '@/pages/public/CourseDetailPage';

const MY_TABS: [string, string, string][] = [
  ['', 'Tất cả', 'IN_PROGRESS,COMPLETED,EXPIRED'],
  ['dang-hoc', 'Đang học', 'IN_PROGRESS'],
  ['hoan-thanh', 'Đã hoàn thành', 'COMPLETED'],
  ['het-han', 'Hết hạn', 'EXPIRED'],
];

/** SCR-CRS-04 — Khóa học của tôi. */
export function MyCoursesPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') ?? '';
  const status = MY_TABS.find((t) => t[0] === tab)?.[2] ?? MY_TABS[0][2];
  const all = useQuery({ queryKey: ['my-courses', 'all'], queryFn: () => api<Page<Card>>('/me/enrollments?size=50') });
  const q = useQuery({ queryKey: ['my-courses', status], queryFn: () => api<Page<Card>>(`/me/enrollments?status=${status}&size=50`) });
  const items = all.data?.items ?? [];
  const count = (s: string) => (s.includes(',') ? items.length : items.filter((c) => c.myEnrollment?.status === s).length);
  const urgent = items.filter((c) => c.myEnrollment?.status === 'IN_PROGRESS' && ['warn', 'danger'].includes(deadlineLevel(c.myEnrollment.expiresAt)));
  const doneLessons = items.reduce((s, c) => s + (c.myEnrollment?.completedLessonCount ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <div className="container" style={{ paddingBottom: 0 }}>
          <h1 style={{ marginBottom: 20 }}>Khóa học của tôi</h1>
          <nav className="tabs" style={{ borderBottom: 0 }}>
            {MY_TABS.map(([k, l, s]) => (
              <a key={k} className={tab === k ? 'active' : ''} onClick={() => setSp(k ? { tab: k } : {})}>
                {l} ({count(s)})
              </a>
            ))}
          </nav>
        </div>
      </div>
      <div className="container">
        <div className="grid-4" style={{ margin: '28px 0' }}>
          <div className="stat">
            <span className="k">Đang học</span>
            <span className="v" style={{ color: 'var(--red)' }}>{count('IN_PROGRESS')}</span>
          </div>
          <div className="stat">
            <span className="k">Đã hoàn thành</span>
            <span className="v" style={{ color: 'var(--red)' }}>{count('COMPLETED')}</span>
          </div>
          <div className="stat">
            <span className="k">Bài học đã xong</span>
            <span className="v" style={{ color: 'var(--red)' }}>{doneLessons}</span>
          </div>
          <div className="stat">
            <span className="k">Hết hạn</span>
            <span className="v" style={{ color: 'var(--red)' }}>{count('EXPIRED')}</span>
          </div>
        </div>
        {urgent.map((c) => (
          <div key={c.id} className={`alert ${deadlineLevel(c.myEnrollment!.expiresAt) === 'danger' ? 'error' : 'warn'}`} style={{ marginBottom: 16 }}>
            <Icon name="alert" />
            <span>
              Khóa <b>"{c.title}"</b> sẽ hết hạn học sau <b>{remaining(c.myEnrollment!.expiresAt)}</b>. Hãy hoàn thành {c.publishedLessonCount - c.myEnrollment!.completedLessonCount} bài còn lại để giữ kết quả.
            </span>
            <Link className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }} to={`/hoc/${c.slug}`}>
              Học ngay
            </Link>
          </div>
        ))}
        {q.error ? (
          <ErrorBox error={q.error} onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <div className="grid-4">
            <CardGridSkeleton />
          </div>
        ) : q.data!.items.length === 0 ? (
          <Empty title="Chưa có khóa học nào ở mục này">
            <Link className="btn btn-primary" to="/khoa-hoc" style={{ marginTop: 8 }}>
              Khám phá khóa học
            </Link>
          </Empty>
        ) : (
          <div className="grid-4">
            {q.data!.items.map((c) => (
              <CourseCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** SCR-AUTH-05 — Hồ sơ cá nhân (FR-AUTH-06, 08, 09). */
export function ProfilePage() {
  const { logout, refreshUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me'], queryFn: () => api<Profile>('/me') });
  const courses = useQuery({ queryKey: ['my-courses', 'all'], queryFn: () => api<Page<Card>>('/me/enrollments?size=50') });
  const [f, setF] = useState({ fullName: '', birthYear: '', hometown: '', workplace: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (q.data) {
      const p = q.data;
      setF({ fullName: p.fullName, birthYear: p.birthYear ? String(p.birthYear) : '', hometown: p.hometown ?? '', workplace: p.workplace ?? '', phone: p.phone ?? '' });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: (show?: boolean) =>
      api<Profile>('/me', { method: 'PUT', body: { ...f, birthYear: f.birthYear ? Number(f.birthYear) : null, showOnLeaderboard: show } }),
    onSuccess: (p) => {
      qc.setQueryData(['me'], p);
      setErrors({});
      toast('Đã lưu thông tin cá nhân');
      refreshUser();
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast(errorMessage(e), 'error');
    },
  });
  const changePw = useMutation({
    mutationFn: () => api('/me/password', { method: 'PUT', body: pw }),
    onSuccess: () => {
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwErrors({});
      toast('Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.');
    },
    onError: (e) => {
      if (e instanceof ApiError) setPwErrors(e.fieldErrors);
      toast(errorMessage(e), 'error');
    },
  });
  const upload = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const p = await api<Profile>('/me/avatar', { method: 'POST', form });
      qc.setQueryData(['me'], p);
      refreshUser();
      toast('Đã cập nhật ảnh đại diện');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const p = q.data!;
  const year = new Date().getFullYear();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined);
  };

  return (
    <div className="container pf" style={{ paddingBottom: 32 }}>
      <aside className="me-card">
        <div className="cover" />
        <div className="who-box">
          <div className="av">
            {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : <span>{p.fullName.split(' ').pop()?.[0]}</span>}
            <label title="Đổi ảnh đại diện">
              <Icon name="upload" size="sm" />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          <b style={{ fontSize: 19, marginTop: 6 }}>{p.fullName}</b>
          <span className="small muted">{p.email}</span>
          {p.emailVerifiedAt && (
            <span className="chip success">
              <Icon name="check-circle" size="sm" />
              Email đã xác thực
            </span>
          )}
          <span className="xs muted">Tham gia từ {formatDate(p.createdAt)}</span>
        </div>
        <nav className="side-menu">
          <a className="on" href="#thong-tin">
            <Icon name="user" />
            Thông tin cá nhân
          </a>
          <a href="#mat-khau">
            <Icon name="lock" />
            Đổi mật khẩu
          </a>
          <Link to="/toi/khoa-hoc">
            <Icon name="book" />
            Khóa học của tôi
          </Link>
          <a href="#rieng-tu">
            <Icon name="shield" />
            Quyền riêng tư
          </a>
          <button className="out" onClick={() => logout().then(() => nav('/'))}>
            <Icon name="logout" />
            Đăng xuất
          </button>
        </nav>
      </aside>

      <div className="stack" style={{ gap: 24 }}>
        <form className="panel" id="thong-tin" onSubmit={submit}>
          <div className="panel-h">
            <h3>Thông tin cá nhân</h3>
            <button className="btn btn-primary btn-sm" disabled={save.isPending}>
              <Icon name="check" size="sm" />
              Lưu thay đổi
            </button>
          </div>
          <div className="panel-b fg2">
            <Field label="Họ và tên" required error={errors.fullName}>
              <input className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} maxLength={100} />
            </Field>
            <Field label="Email" hint="Chưa hỗ trợ đổi email trong phiên bản này.">
              <div className="input" style={{ background: '#f5eeed', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {p.email}
                <Icon name="lock" size="sm" />
              </div>
            </Field>
            <Field label="Năm sinh" error={errors.birthYear}>
              <select className="input" value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: e.target.value })}>
                <option value="">— Chọn năm —</option>
                {Array.from({ length: year - 1919 }, (_, i) => year - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Số điện thoại" error={errors.phone}>
              <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" />
            </Field>
            <Field label="Quê quán" error={errors.hometown}>
              <input className="input" value={f.hometown} onChange={(e) => setF({ ...f, hometown: e.target.value })} />
            </Field>
            <Field label="Nơi công tác" error={errors.workplace}>
              <input className="input" value={f.workplace} onChange={(e) => setF({ ...f, workplace: e.target.value })} />
            </Field>
          </div>
        </form>

        <div className="grid-2">
          <form
            className="panel"
            id="mat-khau"
            onSubmit={(e) => {
              e.preventDefault();
              changePw.mutate();
            }}
          >
            <div className="panel-h">
              <h3>Đổi mật khẩu</h3>
            </div>
            <div className="panel-b stack" style={{ gap: 16 }}>
              <Field label="Mật khẩu hiện tại" error={pwErrors.currentPassword}>
                <PasswordInput value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" />
              </Field>
              <Field label="Mật khẩu mới" error={pwErrors.newPassword} hint="8–64 ký tự, có chữ cái và chữ số, khác mật khẩu hiện tại.">
                <PasswordInput value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" />
              </Field>
              <Field label="Nhập lại mật khẩu mới" error={pwErrors.confirmPassword}>
                <PasswordInput value={pw.confirmPassword} onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} autoComplete="new-password" />
              </Field>
              <button className="btn btn-outline" disabled={!pw.currentPassword || !pw.newPassword || changePw.isPending}>
                Cập nhật mật khẩu
              </button>
            </div>
          </form>
          <div className="stack" style={{ gap: 24 }}>
            <div className="panel" id="rieng-tu">
              <div className="panel-h">
                <h3>Quyền riêng tư</h3>
              </div>
              <div className="panel-b row-between">
                <div>
                  <div className="bold small">Hiện tên trên bảng xếp hạng</div>
                  <div className="xs muted">Tắt để hiển thị là "Học viên ẩn danh"</div>
                </div>
                <Toggle on={p.showOnLeaderboard} label="Hiện tên trên bảng xếp hạng" onChange={(v) => save.mutate(v)} />
              </div>
            </div>
            <div className="panel">
              <div className="panel-h">
                <h3>Phiên đăng nhập</h3>
              </div>
              <div className="panel-b stack" style={{ gap: 14 }}>
                <span className="small muted">Đăng xuất khỏi mọi thiết bị nếu bạn nghi tài khoản bị lộ hoặc đã đăng nhập ở máy dùng chung.</span>
                <button
                  className="btn btn-light"
                  onClick={async () => {
                    const r = await confirm({
                      title: 'Đăng xuất khỏi tất cả thiết bị?',
                      reference: 'FR-AUTH-06',
                      icon: 'logout',
                      tone: 'brand',
                      confirmText: 'Đăng xuất tất cả',
                      body: 'Mọi phiên đăng nhập, kể cả thiết bị này, sẽ kết thúc. Bạn cần đăng nhập lại để tiếp tục học.',
                    });
                    if (r.ok) logout(true).then(() => nav('/dang-nhap'));
                  }}
                >
                  <Icon name="logout" size="sm" />
                  Đăng xuất khỏi tất cả thiết bị
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>Khóa học đã đăng ký</h3>
            <Link className="small bold" to="/toi/khoa-hoc">
              Xem tất cả
            </Link>
          </div>
          <div className="panel-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {(courses.data?.items ?? []).slice(0, 5).map((c) => {
              const e = c.myEnrollment!;
              return (
                <div key={c.id} className="crow">
                  <Thumb url={c.thumbnailUrl} label={c.parentCategoryName} id={c.id} className="th" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link className="bold" style={{ color: 'var(--ink)' }} to={`/khoa-hoc/${c.slug}`}>
                      {c.title}
                    </Link>
                    <div>
                      {e.status === 'IN_PROGRESS' && (
                        <span className={`deadline ${deadlineLevel(e.expiresAt) === 'ok' ? '' : 'warn'}`}>
                          <Icon name="hourglass" size="sm" />
                          Còn {remaining(e.expiresAt)}
                        </span>
                      )}
                      {e.status === 'COMPLETED' && <span className="chip success">Hoàn thành {formatDate(e.completedAt)}</span>}
                      {e.status === 'EXPIRED' && <span className="chip error">Hết hạn {formatDate(e.expiresAt)}</span>}
                    </div>
                  </div>
                  <div style={{ width: 180 }}>
                    <div className="row-between xs bold">
                      <span>Tiến độ</span>
                      <span>{e.progressPercent}%</span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Progress value={e.progressPercent} tone={e.status === 'COMPLETED' ? 'success' : undefined} />
                    </div>
                  </div>
                </div>
              );
            })}
            {courses.data?.items.length === 0 && <p className="muted" style={{ padding: '14px 0' }}>Bạn chưa đăng ký khóa học nào.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** FR-RNK-01 — Bảng xếp hạng (chọn khóa học). */
export function LeaderboardPage() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [page, setPage] = useState(0);
  const courses = useQuery({ queryKey: ['courses', 'for-ranking'], queryFn: () => api<Page<Card>>('/courses?sort=popular&size=50') });
  const slug = sp.get('khoa') ?? courses.data?.items[0]?.slug ?? '';
  const q = useQuery({
    queryKey: ['ranking', slug, page, 20, user?.id],
    queryFn: () => api<Page<RankingRow>>(`/courses/${slug}/ranking?page=${page}&size=20`),
    enabled: !!slug,
  });
  const top = page === 0 ? q.data?.items.slice(0, 3) ?? [] : [];
  const rest = page === 0 ? { ...q.data!, items: q.data?.items.slice(3) ?? [] } : q.data;
  const podium = [top[1], top[0], top[2]];
  return (
    <>
      <section className="rk-hero">
        <div className="container">
          <Icon name="trophy" size="lg" style={{ color: 'var(--gold)' }} />
          <h1 style={{ marginTop: 8 }}>Bảng xếp hạng</h1>
          <p style={{ opacity: 0.9, marginTop: 6 }}>Điểm cao hơn xếp trên · Bằng điểm thì ai làm nhanh hơn xếp trên</p>
          <select
            value={slug}
            onChange={(e) => {
              setPage(0);
              setSp({ khoa: e.target.value });
            }}
            aria-label="Chọn khóa học"
          >
            {courses.data?.items.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </section>
      <div className="container">
        {page === 0 && (
          <div className="podium">
            {podium.map((r, i) =>
              r ? (
                <div key={r.userId} className={`pd${r.rank === 1 ? ' first' : ''}`}>
                  <span className={`medal m${r.rank <= 3 ? r.rank : 'x'}`}>{r.rank}</span>
                  <Avatar name={r.displayName} url={r.avatarUrl} />
                  <b style={{ fontSize: r.rank === 1 ? 18 : undefined }}>{r.me ? `Bạn — ${r.displayName}` : r.displayName}</b>
                  <span className="pts" style={{ fontSize: r.rank === 1 ? 32 : undefined }}>{formatNumber(r.totalScore)}</span>
                  <span className="small muted">
                    {formatClock(r.totalDurationSeconds)} · {r.completedQuizCount} quiz
                  </span>
                </div>
              ) : (
                <div key={'e' + i} className="pd empty-slot">
                  <span className="medal mx">{[2, 1, 3][i]}</span>
                  <span className="small muted">Chưa có</span>
                </div>
              ),
            )}
          </div>
        )}
        {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : rest && rest.items.length > 0 && <RankingTable data={rest} />}
        {q.data && <Pager page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} />}
        <div className="row small muted" style={{ marginTop: 14, alignItems: 'flex-start' }}>
          <Icon name="info" size="sm" />
          Tên người học được rút gọn với khách chưa đăng nhập. Bạn có thể ẩn tên mình trong trang Hồ sơ. Lượt học hết hạn sẽ bị xóa khỏi bảng xếp hạng.
        </div>
        {slug && (
          <p style={{ marginTop: 16 }}>
            <Link className="bold" to={`/khoa-hoc/${slug}`}>
              Xem chi tiết khóa học <Icon name="chevron-right" size="sm" />
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
