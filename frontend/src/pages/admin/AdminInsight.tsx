import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '@/api/client';
import type { Page } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Layout';
import { Empty, ErrorBox, Pager, Spinner, Stars, errorMessage, useConfirm, useDebounced, useToast } from '@/components/ui';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { AdminPage } from './AdminLayout';
import { ACTION_LABEL, ENTITY_LABEL, actionChip } from './AdminDashboard';

interface ReviewAdmin {
  id: number;
  courseId: number;
  courseTitle: string;
  courseSlug: string;
  userId: number;
  authorName: string;
  rating: number;
  comment?: string;
  isHidden: boolean;
  hiddenReason?: string;
  hiddenByName?: string;
  hiddenAt?: string;
  createdAt: string;
}

/** SCR-ADM-08 — FR-ADM-20. */
export function AdminReviews() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const hidden = sp.get('hidden') ?? '';
  const rating = sp.get('rating') ?? '';
  const page = Number(sp.get('page') ?? 0);
  const params = qs({ hidden, rating, q: dq, page, size: 20 });
  const list = useQuery({ queryKey: ['admin', 'reviews', params], queryFn: () => api<Page<ReviewAdmin>>(`/admin/reviews${params}`), placeholderData: keepPreviousData });
  const counts = useQuery({ queryKey: ['admin', 'review-counts'], queryFn: () => api<Record<string, number>>('/admin/reviews/counts') });
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    n.delete('page');
    setSp(n);
  };
  const act = useMutation({
    mutationFn: ({ id, action, reason }: { id: number; action: 'hide' | 'show'; reason?: string }) => api(`/admin/reviews/${id}/${action}`, { method: 'POST', body: { reason } }),
    onSuccess: (_d, v) => {
      toast(v.action === 'hide' ? 'Đã ẩn đánh giá' : 'Đã hiện lại đánh giá');
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      qc.invalidateQueries({ queryKey: ['admin', 'review-counts'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const hide = async (r: ReviewAdmin) => {
    const res = await confirm({
      title: 'Ẩn đánh giá này?',
      reference: 'FR-ADM-20',
      icon: 'eye',
      tone: 'brand',
      confirmText: 'Ẩn đánh giá',
      body: `Đánh giá ${r.rating} sao của ${r.authorName} sẽ không hiển thị và không được tính vào điểm trung bình của khóa học.`,
      reason: { label: 'Lý do', placeholder: 'Ví dụ: Spam / quảng cáo, ngôn từ xúc phạm...' },
    });
    if (res.ok) act.mutate({ id: r.id, action: 'hide', reason: res.reason });
  };
  return (
    <AdminPage
      crumbs={[['Quản trị', '/admin'], ['Kiểm duyệt đánh giá']]}
      title="Kiểm duyệt đánh giá"
      actions={
        <>
          {(
            [
              ['', `Tất cả (${formatNumber(counts.data?.all)})`],
              ['false', `Đang hiển thị (${formatNumber(counts.data?.visible)})`],
              ['true', `Đã ẩn (${formatNumber(counts.data?.hidden)})`],
            ] as const
          ).map(([v, l]) => (
            <button key={v} className={`chip outline${hidden === v ? ' on' : ''}`} onClick={() => set('hidden', v)}>
              {l}
            </button>
          ))}
        </>
      }
    >
      <div className="panel">
        <div className="toolbar-a">
          <div className="search-a">
            <Icon name="search" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo nội dung, người viết" style={{ border: 0, outline: 'none', font: 'inherit', flex: 1, background: 'transparent' }} />
          </div>
          <select className="dd" value={rating} onChange={(e) => set('rating', e.target.value)} aria-label="Số sao">
            <option value="">Số sao: Tất cả</option>
            <option value="1,2">1–2 sao</option>
            <option value="3">3 sao</option>
            <option value="4,5">4–5 sao</option>
          </select>
        </div>
        {list.isLoading ? (
          <Spinner />
        ) : list.error ? (
          <ErrorBox error={list.error} />
        ) : list.data!.items.length === 0 ? (
          <div className="panel-b">
            <Empty icon="message" title="Không có đánh giá phù hợp" />
          </div>
        ) : (
          list.data!.items.map((r) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 20, padding: '18px 20px', borderBottom: '1px solid var(--line)', background: r.isHidden ? '#fbf6f5' : undefined }}>
              <div>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <Avatar name={r.authorName} className="sm" />
                  <div>
                    <b>{r.authorName}</b>{' '}
                    <span className="small muted">
                      · <Link to={`/khoa-hoc/${r.courseSlug}?tab=danh-gia`} target="_blank">{r.courseTitle}</Link> · {formatDate(r.createdAt)}
                    </span>
                    <div>
                      <Stars value={r.rating} />
                    </div>
                  </div>
                </div>
                <p style={{ marginTop: 10, color: r.isHidden ? 'var(--ink-3)' : undefined }}>{r.comment || <i className="muted">(Không có nhận xét)</i>}</p>
                {r.isHidden && (
                  <div className="row xs muted" style={{ marginTop: 10, background: '#f5eeed', borderRadius: 8, padding: '8px 12px' }}>
                    <Icon name="info" size="sm" />
                    Ẩn bởi {r.hiddenByName} lúc {formatDateTime(r.hiddenAt)} — Lý do: {r.hiddenReason}
                  </div>
                )}
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {r.isHidden ? <span className="chip neutral" style={{ alignSelf: 'flex-start' }}>Đã ẩn</span> : <span className="chip success" style={{ alignSelf: 'flex-start' }}>Đang hiển thị</span>}
                {r.isHidden ? (
                  <button className="btn btn-sm btn-light" onClick={() => act.mutate({ id: r.id, action: 'show' })}>
                    <Icon name="refresh" size="sm" />
                    Hiện lại
                  </button>
                ) : (
                  <button className="btn btn-sm btn-outline" style={r.rating <= 2 ? { color: 'var(--error)', borderColor: 'var(--error)' } : undefined} onClick={() => hide(r)}>
                    <Icon name="eye" size="sm" />
                    Ẩn đánh giá
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {list.data && (
          <div className="pager-a">
            <span>{formatNumber(list.data.totalItems)} đánh giá</span>
            <Pager page={page} totalPages={list.data.totalPages} onChange={(p) => set('page', String(p))} />
          </div>
        )}
      </div>
      <div className="alert info">
        <Icon name="info" />
        <span>Đánh giá bị ẩn không hiển thị ở trang khóa học và không tính vào điểm trung bình. Ẩn đánh giá bắt buộc nhập lý do và được ghi vào nhật ký thao tác.</span>
      </div>
    </AdminPage>
  );
}

interface AuditRow {
  id: number;
  createdAt: string;
  actorId?: number;
  actorName: string;
  actionType: string;
  entityType: string;
  entityId?: number;
  beforeData?: string;
  afterData?: string;
  ipAddress?: string;
}

function pretty(json?: string) {
  if (!json) return '—';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

/** SCR-ADM-09 — FR-ADM-22. */
export function AdminAuditLogs() {
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState<number | null>(null);
  const get = (k: string) => sp.get(k) ?? '';
  const page = Number(get('page') || 0);
  const params = qs({ actorId: get('actorId'), entityType: get('entityType'), actionType: get('actionType'), from: get('from'), to: get('to'), page, size: 20 });
  const list = useQuery({ queryKey: ['admin', 'audit', params], queryFn: () => api<Page<AuditRow>>(`/admin/audit-logs${params}`), placeholderData: keepPreviousData });
  const actors = useQuery({ queryKey: ['admin', 'audit-actors'], queryFn: () => api<{ id: number; fullName: string }[]>('/admin/audit-logs/actors') });
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    n.delete('page');
    setSp(n);
  };
  return (
    <AdminPage crumbs={[['Quản trị', '/admin'], ['Nhật ký thao tác']]} title="Nhật ký thao tác" actions={<span className="small muted">Lưu trữ tối thiểu 1 năm</span>}>
      <div className="panel">
        <div className="toolbar-a">
          <select className="dd" value={get('actorId')} onChange={(e) => set('actorId', e.target.value)} aria-label="Người thao tác">
            <option value="">Người thao tác: Tất cả</option>
            {actors.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName}
              </option>
            ))}
          </select>
          <select className="dd" value={get('entityType')} onChange={(e) => set('entityType', e.target.value)} aria-label="Đối tượng">
            <option value="">Đối tượng: Tất cả</option>
            {Object.entries(ENTITY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className="dd" value={get('actionType')} onChange={(e) => set('actionType', e.target.value)} aria-label="Hành động">
            <option value="">Hành động: Tất cả</option>
            {Object.entries(ACTION_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label className="dd">
            Từ
            <input type="date" value={get('from')} onChange={(e) => set('from', e.target.value)} style={{ border: 0, font: 'inherit' }} />
          </label>
          <label className="dd">
            Đến
            <input type="date" value={get('to')} onChange={(e) => set('to', e.target.value)} style={{ border: 0, font: 'inherit' }} />
          </label>
          <button className="link-btn small" onClick={() => setSp({})}>
            Xóa bộ lọc
          </button>
        </div>
        {list.isLoading ? (
          <Spinner />
        ) : list.error ? (
          <ErrorBox error={list.error} />
        ) : (
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thao tác</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>IP</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data!.items.map((a) => (
                  <Fragment key={a.id}>
                    <tr onClick={() => setOpen(open === a.id ? null : a.id)} style={{ cursor: 'pointer', background: open === a.id ? 'var(--red-tint)' : undefined }}>
                      <td>{formatDateTime(a.createdAt)}</td>
                      <td>{a.actorName}</td>
                      <td>{actionChip(a.actionType)}</td>
                      <td>
                        <b>
                          {ENTITY_LABEL[a.entityType] ?? a.entityType}
                          {a.entityId ? ` #${a.entityId}` : ''}
                        </b>
                      </td>
                      <td style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13, color: 'var(--ink-2)' }}>{a.ipAddress ?? '—'}</td>
                      <td>
                        <Icon name={open === a.id ? 'chevron-down' : 'chevron-right'} size="sm" />
                      </td>
                    </tr>
                    {open === a.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <div className="diff" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '4px 12px 16px' }}>
                            <div>
                              <div className="xs bold muted" style={{ textTransform: 'uppercase', margin: '8px 0 6px' }}>Trước</div>
                              <pre>{pretty(a.beforeData)}</pre>
                            </div>
                            <div>
                              <div className="xs bold muted" style={{ textTransform: 'uppercase', margin: '8px 0 6px' }}>Sau</div>
                              <pre>{pretty(a.afterData)}</pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {list.data!.items.length === 0 && (
              <div className="panel-b">
                <Empty icon="file" title="Không có bản ghi phù hợp" />
              </div>
            )}
          </div>
        )}
        {list.data && (
          <div className="pager-a">
            <span>{formatNumber(list.data.totalItems)} bản ghi</span>
            <Pager page={page} totalPages={list.data.totalPages} onChange={(p) => set('page', String(p))} />
          </div>
        )}
      </div>
    </AdminPage>
  );
}
