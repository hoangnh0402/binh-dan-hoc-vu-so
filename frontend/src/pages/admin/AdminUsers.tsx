import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, download, qs } from '@/api/client';
import type { Page } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Layout';
import { Empty, ErrorBox, Field, Modal, Pager, PasswordInput, Progress, Spinner, errorMessage, useConfirm, useDebounced, useToast } from '@/components/ui';
import { ENROLL_STATUS_LABEL, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { AdminPage } from './AdminLayout';

interface UserRow {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  status: string;
  roles: string;
  createdAt: string;
  lastLoginAt?: string;
}
interface UserDetail {
  id: number;
  fullName: string;
  email: string;
  birthYear?: number;
  hometown?: string;
  workplace?: string;
  phone?: string;
  avatarUrl?: string;
  status: string;
  lockReason?: string;
  roles: string[];
  createdAt: string;
  lastLoginAt?: string;
  emailVerifiedAt?: string;
  enrollments: {
    courseId: number;
    courseTitle: string;
    courseSlug: string;
    status: string;
    roundNo: number;
    progressPercent: number;
    enrolledAt: string;
    expiresAt: string;
    completedAt?: string;
    totalScore?: number;
  }[];
}

export function statusChip(s: string) {
  if (s === 'ACTIVE') return <span className="chip success">Hoạt động</span>;
  if (s === 'LOCKED')
    return (
      <span className="chip error">
        <Icon name="lock" size="sm" />
        Bị khóa
      </span>
    );
  return <span className="chip warn">Chờ xác thực</span>;
}

/** SCR-ADM-02 — FR-ADM-01, 03..06. */
export function AdminUsers() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounced(q);
  const role = sp.get('role') ?? '';
  const status = sp.get('status') ?? '';
  const page = Number(sp.get('page') ?? 0);
  const [selected, setSelected] = useState<number | null>(null);
  const params = qs({ q: dq, role, status, page, size: 20 });
  const list = useQuery({ queryKey: ['admin', 'users', params], queryFn: () => api<Page<UserRow>>(`/admin/users${params}`), placeholderData: keepPreviousData });
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    n.delete('page');
    setSp(n);
  };
  return (
    <AdminPage
      crumbs={[['Quản trị', '/admin'], ['Người dùng']]}
      title={
        <>
          Người dùng <span className="muted" style={{ fontSize: 18, fontWeight: 600 }}>{list.data ? formatNumber(list.data.totalItems) : ''}</span>
        </>
      }
      actions={
        <>
          <button className="btn btn-light" onClick={() => download(`/admin/users/export${qs({ q: dq, role, status })}`, 'nguoi-dung.csv')}>
            <Icon name="download" />
            Xuất CSV
          </button>
          <Link className="btn btn-primary" to="/admin/nguoi-dung/moi">
            <Icon name="plus" />
            Tạo người dùng
          </Link>
        </>
      }
    >
      <div className="split" style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 20, alignItems: 'start' }}>
        <div className="panel">
          <div className="toolbar-a">
            <div className="search-a">
              <Icon name="search" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm họ tên, email, SĐT" style={{ border: 0, outline: 'none', font: 'inherit', flex: 1, background: 'transparent' }} aria-label="Tìm người dùng" />
            </div>
            <select className="dd" value={role} onChange={(e) => set('role', e.target.value)} aria-label="Vai trò">
              <option value="">Vai trò: Tất cả</option>
              <option value="ADMIN">Quản trị</option>
              <option value="USER">Người học</option>
            </select>
            <select className="dd" value={status} onChange={(e) => set('status', e.target.value)} aria-label="Trạng thái">
              <option value="">Trạng thái: Tất cả</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="LOCKED">Bị khóa</option>
              <option value="PENDING_VERIFICATION">Chờ xác thực</option>
            </select>
          </div>
          {list.error ? (
            <ErrorBox error={list.error} />
          ) : list.isLoading ? (
            <Spinner />
          ) : list.data!.items.length === 0 ? (
            <div className="panel-b">
              <Empty icon="users" title="Không có người dùng phù hợp" />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Đăng nhập cuối</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data!.items.map((u) => (
                    <tr key={u.id} onClick={() => setSelected(u.id)} style={{ cursor: 'pointer', background: selected === u.id ? 'var(--red-tint)' : undefined }}>
                      <td>
                        <div className="who">
                          <Avatar name={u.fullName} url={u.avatarUrl} className="sm" />
                          <div>
                            <div className="bold">{u.fullName}</div>
                            <div className="sub">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{u.roles.includes('ADMIN') ? <span className="chip solid">ADMIN</span> : <span className="chip neutral">USER</span>}</td>
                      <td>{statusChip(u.status)}</td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {list.data && (
            <div className="pager-a">
              <span>
                Hiển thị {list.data.items.length ? page * 20 + 1 : 0}–{page * 20 + list.data.items.length} / {formatNumber(list.data.totalItems)}
              </span>
              <Pager page={page} totalPages={list.data.totalPages} onChange={(p) => set('page', String(p))} />
            </div>
          )}
        </div>
        {selected && <UserPanel id={selected} onClose={() => setSelected(null)} />}
      </div>
    </AdminPage>
  );
}

function UserPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const q = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => api<UserDetail>(`/admin/users/${id}`) });
  const act = useMutation({
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: string; body?: unknown }) => api(`/admin/users/${id}${path}`, { method, body }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      if (v.method === 'DELETE') {
        onClose();
        toast('Đã xóa người dùng', 'info');
      } else {
        qc.invalidateQueries({ queryKey: ['admin', 'user', id] });
        toast('Đã cập nhật');
      }
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  if (q.isLoading) return <div className="panel"><Spinner /></div>;
  if (q.error) return <div className="panel"><ErrorBox error={q.error} /></div>;
  const u = q.data!;
  return (
    <div className="panel">
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', borderBottom: '1px solid var(--line)', position: 'relative' }}>
        <button className="icon-btn" style={{ position: 'absolute', right: 10, top: 10, width: 34, height: 34 }} onClick={onClose} aria-label="Đóng">
          <Icon name="x" size="sm" />
        </button>
        <Avatar name={u.fullName} url={u.avatarUrl} className="" />
        <b style={{ fontSize: 18 }}>{u.fullName}</b>
        <span className="small muted">{u.email}</span>
        <div className="row" style={{ gap: 6 }}>
          {u.roles.includes('ADMIN') ? <span className="chip solid">ADMIN</span> : <span className="chip neutral">USER</span>}
          {statusChip(u.status)}
        </div>
        {u.lockReason && <span className="xs" style={{ color: 'var(--error)' }}>Lý do khóa: {u.lockReason}</span>}
      </div>
      <div className="panel-b stack" style={{ gap: 16 }}>
        <dl style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 12px', margin: 0, fontSize: 14 }}>
          <dt className="muted">ID</dt>
          <dd style={{ margin: 0 }} className="bold">{u.id}</dd>
          <dt className="muted">Năm sinh</dt>
          <dd style={{ margin: 0 }}>{u.birthYear ?? '—'}</dd>
          <dt className="muted">Quê quán</dt>
          <dd style={{ margin: 0 }}>{u.hometown ?? '—'}</dd>
          <dt className="muted">Nơi công tác</dt>
          <dd style={{ margin: 0 }}>{u.workplace ?? '—'}</dd>
          <dt className="muted">Điện thoại</dt>
          <dd style={{ margin: 0 }}>{u.phone ?? '—'}</dd>
          <dt className="muted">Đăng nhập cuối</dt>
          <dd style={{ margin: 0 }}>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</dd>
        </dl>
        <div>
          <div className="bold small" style={{ marginBottom: 4 }}>Khóa học đã ghi danh ({u.enrollments.length})</div>
          {u.enrollments.map((e) => (
            <div key={e.courseId} style={{ padding: '10px 0', borderBottom: '1px dashed var(--line)', fontSize: 14 }}>
              <div className="row-between">
                <Link className="bold" style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }} to={`/admin/khoa-hoc/${e.courseId}?tab=hoc-vien`}>
                  {e.courseTitle}
                </Link>
                <span className={`chip ${e.status === 'COMPLETED' ? 'success' : e.status === 'EXPIRED' ? 'error' : e.status === 'CANCELLED' ? 'neutral' : 'warn'}`}>{ENROLL_STATUS_LABEL[e.status]}</span>
              </div>
              {e.status === 'IN_PROGRESS' && <Progress value={e.progressPercent} />}
              <span className="xs muted">
                Lần học {e.roundNo} · {e.progressPercent}%{e.totalScore ? ` · ${formatNumber(e.totalScore)} điểm` : ''}
                {e.status === 'IN_PROGRESS' ? ` · hạn ${formatDate(e.expiresAt)}` : ''}
              </span>
            </div>
          ))}
        </div>
        <button className="btn btn-light btn-block" onClick={() => setEditing(true)}>
          <Icon name="edit" size="sm" />
          Sửa thông tin & vai trò
        </button>
        <button
          className="btn btn-light btn-block"
          onClick={async () =>
            (await confirm({ title: 'Gửi email đặt lại mật khẩu?', body: `Liên kết đặt mật khẩu (hiệu lực 24 giờ) sẽ được gửi tới ${u.email}.`, confirmText: 'Gửi email', icon: 'mail' })).ok &&
            act.mutate({ path: '/send-reset-password' })
          }
        >
          <Icon name="mail" size="sm" />
          Gửi email đặt lại mật khẩu
        </button>
        {u.status === 'LOCKED' ? (
          <button className="btn btn-outline btn-block" onClick={() => act.mutate({ path: '/unlock' })}>
            <Icon name="refresh" size="sm" />
            Mở khóa tài khoản
          </button>
        ) : (
          <button
            className="btn btn-outline btn-block"
            style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
            onClick={async () => {
              const r = await confirm({
                title: `Khóa tài khoản ${u.fullName}?`,
                reference: 'FR-ADM-05',
                danger: true,
                icon: 'lock',
                confirmText: 'Khóa tài khoản',
                body: 'Người dùng bị đăng xuất ngay trên mọi thiết bị và không đăng nhập được cho tới khi mở khóa. Dữ liệu học tập được giữ nguyên.',
                reason: { label: 'Lý do khóa' },
              });
              if (r.ok) act.mutate({ path: '/lock', body: { reason: r.reason } });
            }}
          >
            <Icon name="lock" size="sm" />
            Khóa tài khoản
          </button>
        )}
        <button
          className="link-btn small"
          style={{ color: 'var(--error)' }}
          onClick={async () => {
            const r = await confirm({
              title: `Xóa người dùng ${u.fullName}?`,
              reference: 'FR-ADM-06',
              danger: true,
              icon: 'trash',
              confirmText: 'Xóa người dùng',
              body: (
                <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', fontSize: 14 }}>
                  <li>Tài khoản bị vô hiệu, email được ẩn danh để có thể đăng ký lại.</li>
                  <li>Dữ liệu học tập giữ lại cho thống kê, loại khỏi bảng xếp hạng.</li>
                </ul>
              ),
            });
            if (r.ok) act.mutate({ path: '', method: 'DELETE' });
          }}
        >
          Xóa người dùng
        </button>
      </div>
      <EditUserModal open={editing} user={u} onClose={() => setEditing(false)} />
    </div>
  );
}

function EditUserModal({ open, user, onClose }: { open: boolean; user: UserDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    fullName: user.fullName,
    email: user.email,
    birthYear: user.birthYear ? String(user.birthYear) : '',
    hometown: user.hometown ?? '',
    workplace: user.workplace ?? '',
    phone: user.phone ?? '',
    admin: user.roles.includes('ADMIN'),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () =>
      api(`/admin/users/${user.id}`, {
        method: 'PUT',
        body: { ...f, birthYear: f.birthYear ? Number(f.birthYear) : null, roles: f.admin ? ['ADMIN', 'USER'] : ['USER'] },
      }),
    onSuccess: () => {
      toast('Đã lưu thông tin người dùng');
      qc.invalidateQueries({ queryKey: ['admin', 'user', user.id] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast(errorMessage(e), 'error');
    },
  });
  return (
    <Modal open={open} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="b">
          <div className="hd">
            <span className="ic brand">
              <Icon name="edit" />
            </span>
            <div>
              <h3>Sửa người dùng</h3>
              <span className="xs muted">FR-ADM-04 · Đổi email sẽ yêu cầu xác thực lại</span>
            </div>
          </div>
          <div className="fgrid">
            <Field label="Họ và tên" required error={errors.fullName}>
              <input className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
            </Field>
            <Field label="Email" required error={errors.email}>
              <input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
            <Field label="Năm sinh" error={errors.birthYear}>
              <input className="input" inputMode="numeric" value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="Số điện thoại" error={errors.phone}>
              <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
            <Field label="Quê quán">
              <input className="input" value={f.hometown} onChange={(e) => setF({ ...f, hometown: e.target.value })} />
            </Field>
            <Field label="Nơi công tác">
              <input className="input" value={f.workplace} onChange={(e) => setF({ ...f, workplace: e.target.value })} />
            </Field>
            <div className="full">
              <label className="check" style={{ cursor: 'pointer' }}>
                <input type="checkbox" className="sr-only" checked={f.admin} onChange={(e) => setF({ ...f, admin: e.target.checked })} />
                <span className={`box${f.admin ? ' on' : ''}`}>{f.admin && <Icon name="check" size="sm" />}</span>
                Cấp quyền quản trị (ADMIN)
              </label>
            </div>
          </div>
        </div>
        <div className="f">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" disabled={save.isPending}>
            Lưu thay đổi
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** FR-ADM-02 — Tạo người dùng. */
export function AdminUserCreate() {
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ fullName: '', email: '', birthYear: '', hometown: '', workplace: '', phone: '', admin: false, status: 'ACTIVE', passwordMode: 'EMAIL_LINK', tempPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/admin/users', {
        method: 'POST',
        body: {
          ...f,
          birthYear: f.birthYear ? Number(f.birthYear) : null,
          roles: f.admin ? ['ADMIN', 'USER'] : ['USER'],
          tempPassword: f.passwordMode === 'TEMP_PASSWORD' ? f.tempPassword : null,
        },
      });
      toast(f.passwordMode === 'EMAIL_LINK' ? 'Đã tạo tài khoản và gửi email đặt mật khẩu' : 'Đã tạo tài khoản');
      nav('/admin/nguoi-dung');
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const choice = (on: boolean) => ({ border: `2px solid ${on ? 'var(--red)' : 'var(--line)'}`, background: on ? 'var(--red-tint)' : '#fff', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer', textAlign: 'left' as const, width: '100%' });
  return (
    <form onSubmit={submit}>
      <AdminPage
        crumbs={[['Quản trị', '/admin'], ['Người dùng', '/admin/nguoi-dung'], ['Tạo người dùng']]}
        title="Tạo người dùng"
        actions={
          <>
            <Link className="btn btn-light" to="/admin/nguoi-dung">
              Hủy
            </Link>
            <button className="btn btn-primary" disabled={busy}>
              <Icon name="check" />
              Tạo tài khoản
            </button>
          </>
        }
      >
        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
          <div className="stack" style={{ gap: 24 }}>
            <div className="panel">
              <div className="panel-h">
                <h3>Thông tin tài khoản</h3>
              </div>
              <div className="panel-b fgrid">
                <Field label="Họ và tên" required error={errors.fullName}>
                  <input className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
                </Field>
                <Field label="Email" required error={errors.email}>
                  <input className={`input${errors.email ? ' invalid' : ''}`} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                </Field>
                <Field label="Năm sinh" error={errors.birthYear}>
                  <input className="input" inputMode="numeric" value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: e.target.value.replace(/\D/g, '') })} />
                </Field>
                <Field label="Số điện thoại" error={errors.phone}>
                  <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                </Field>
                <Field label="Quê quán">
                  <input className="input" value={f.hometown} onChange={(e) => setF({ ...f, hometown: e.target.value })} />
                </Field>
                <Field label="Nơi công tác">
                  <input className="input" value={f.workplace} onChange={(e) => setF({ ...f, workplace: e.target.value })} />
                </Field>
              </div>
            </div>
            <div className="panel">
              <div className="panel-h">
                <h3>Đặt mật khẩu</h3>
              </div>
              <div className="panel-b stack">
                <button type="button" style={choice(f.passwordMode === 'EMAIL_LINK')} onClick={() => setF({ ...f, passwordMode: 'EMAIL_LINK' })}>
                  <span className={`radio${f.passwordMode === 'EMAIL_LINK' ? ' on' : ''}`} />
                  <div>
                    <b>Gửi email để người dùng tự đặt mật khẩu</b>
                    <div className="small muted">Liên kết đặt mật khẩu có hiệu lực trong 24 giờ. Khuyến nghị dùng cách này.</div>
                  </div>
                </button>
                <button type="button" style={choice(f.passwordMode === 'TEMP_PASSWORD')} onClick={() => setF({ ...f, passwordMode: 'TEMP_PASSWORD' })}>
                  <span className={`radio${f.passwordMode === 'TEMP_PASSWORD' ? ' on' : ''}`} />
                  <div style={{ flex: 1 }}>
                    <b>Nhập mật khẩu tạm</b>
                    <div className="small muted">Bạn tự gửi mật khẩu tạm cho người dùng. 8–64 ký tự, có chữ cái và chữ số.</div>
                  </div>
                </button>
                {f.passwordMode === 'TEMP_PASSWORD' && (
                  <Field label="Mật khẩu tạm" required error={errors.tempPassword}>
                    <PasswordInput value={f.tempPassword} onChange={(e) => setF({ ...f, tempPassword: e.target.value })} autoComplete="new-password" />
                  </Field>
                )}
              </div>
            </div>
          </div>
          <div className="stack" style={{ gap: 24 }}>
            <div className="panel">
              <div className="panel-h">
                <h3>Vai trò &amp; trạng thái</h3>
              </div>
              <div className="panel-b stack" style={{ gap: 16 }}>
                <Field label="Vai trò" required>
                  <div className="grid-2" style={{ gap: 10 }}>
                    {[
                      [false, 'Người học', 'USER'],
                      [true, 'Quản trị', 'ADMIN'],
                    ].map(([v, l, c]) => (
                      <button key={String(c)} type="button" style={choice(f.admin === v)} onClick={() => setF({ ...f, admin: v as boolean })}>
                        <span className={`radio${f.admin === v ? ' on' : ''}`} />
                        <div>
                          <b style={{ whiteSpace: 'nowrap' }}>{l as string}</b>
                          <div className="xs muted">{c as string}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Trạng thái" required>
                  <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="LOCKED">Bị khóa</option>
                  </select>
                </Field>
                <div className="alert success" style={{ fontSize: 14 }}>
                  <Icon name="check-circle" size="sm" />
                  <span>
                    Tài khoản do quản trị viên tạo được coi là <b>đã xác thực email</b>, không cần nhập OTP.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminPage>
    </form>
  );
}
