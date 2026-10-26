import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, download, qs } from '@/api/client';
import type { CategoryNode, Page, RankingRow } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Thumb, TimeStatusChip } from '@/components/CourseCard';
import { RichEditor, uploadFile } from '@/components/RichEditor';
import { Empty, ErrorBox, Field, Pager, Spinner, Toggle, errorMessage, useConfirm, useDebounced, useToast } from '@/components/ui';
import { ENROLL_STATUS_LABEL, LEVEL_LABEL, formatClock, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { RankingTable } from '@/pages/public/CourseDetailPage';
import { AdminPage } from './AdminLayout';

interface CourseRow {
  id: number;
  slug: string;
  title: string;
  thumbnailUrl?: string;
  categoryName: string;
  parentCategoryName: string;
  organizationName: string;
  level: string;
  publishStatus: string;
  timeStatus: string;
  publishedLessonCount: number;
  lessonCount: number;
  enrollmentCount: number;
  learningDurationDays: number;
  isFeatured: boolean;
  updatedAt: string;
}
interface CourseForm {
  id: number;
  slug: string;
  title: string;
  categoryId: number;
  organizationId: number;
  level: string;
  shortDescription: string;
  description?: string;
  outcomes?: string;
  targetAudience?: string;
  prerequisites?: string;
  thumbnailUrl?: string;
  startDate?: string;
  endDate?: string;
  learningDurationDays: number;
  estimatedMinutes?: number;
  isFeatured: boolean;
  certificateCriteria?: string;
  publishStatus: string;
  timeStatus: string;
  enrollmentCount: number;
  activeLearners: number;
  publishedLessonCount: number;
  updatedAt: string;
}
interface OrgItem {
  id: number;
  name: string;
  isActive: boolean;
}

export function publishChip(s: string) {
  if (s === 'PUBLISHED') return <span className="chip solid">Đã xuất bản</span>;
  if (s === 'ARCHIVED') return <span className="chip neutral">Lưu trữ</span>;
  return <span className="chip warn">Bản nháp</span>;
}

/** SCR-ADM-05 — FR-ADM-12. */
export function AdminCourses() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounced(q);
  const get = (k: string) => sp.get(k) ?? '';
  const page = Number(get('page') || 0);
  const params = qs({ q: dq, categoryId: get('categoryId'), organizationId: get('organizationId'), level: get('level'), publishStatus: get('publishStatus'), timeStatus: get('timeStatus'), page, size: 20 });
  const list = useQuery({ queryKey: ['admin', 'courses', params], queryFn: () => api<Page<CourseRow>>(`/admin/courses${params}`), placeholderData: keepPreviousData });
  const cats = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api<CategoryNode[]>('/admin/categories') });
  const orgs = useQuery({ queryKey: ['admin', 'orgs', ''], queryFn: () => api<OrgItem[]>('/admin/organizations?q=') });
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    n.delete('page');
    setSp(n);
  };
  return (
    <AdminPage
      crumbs={[['Quản trị', '/admin'], ['Khóa học']]}
      title={
        <>
          Khóa học <span className="muted" style={{ fontSize: 18, fontWeight: 600 }}>{list.data ? formatNumber(list.data.totalItems) : ''}</span>
        </>
      }
      actions={
        <Link className="btn btn-primary" to="/admin/khoa-hoc/moi">
          <Icon name="plus" />
          Tạo khóa học
        </Link>
      }
    >
      <div className="panel">
        <div className="toolbar-a">
          <div className="search-a">
            <Icon name="search" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên khóa học (gõ không dấu cũng được)" style={{ border: 0, outline: 'none', font: 'inherit', flex: 1, background: 'transparent' }} />
          </div>
          <select className="dd" value={get('categoryId')} onChange={(e) => set('categoryId', e.target.value)} aria-label="Lĩnh vực">
            <option value="">Lĩnh vực: Tất cả</option>
            {cats.data?.map((c) => [
              <option key={c.id} value={c.id}>
                {c.name}
              </option>,
              ...c.children.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  — {ch.name}
                </option>
              )),
            ])}
          </select>
          <select className="dd" value={get('organizationId')} onChange={(e) => set('organizationId', e.target.value)} aria-label="Tổ chức">
            <option value="">Tổ chức: Tất cả</option>
            {orgs.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select className="dd" value={get('level')} onChange={(e) => set('level', e.target.value)} aria-label="Trình độ">
            <option value="">Trình độ</option>
            {Object.entries(LEVEL_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className="dd" value={get('publishStatus')} onChange={(e) => set('publishStatus', e.target.value)} aria-label="Xuất bản">
            <option value="">Xuất bản: Tất cả</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Đã xuất bản</option>
            <option value="ARCHIVED">Lưu trữ</option>
          </select>
          <select className="dd" value={get('timeStatus')} onChange={(e) => set('timeStatus', e.target.value)} aria-label="Thời gian">
            <option value="">Thời gian: Tất cả</option>
            <option value="UPCOMING">Sắp mở</option>
            <option value="OPEN">Đang mở</option>
            <option value="ENDED">Đã kết thúc</option>
          </select>
        </div>
        {list.error ? (
          <ErrorBox error={list.error} />
        ) : list.isLoading ? (
          <Spinner />
        ) : list.data!.items.length === 0 ? (
          <div className="panel-b">
            <Empty title="Không có khóa học phù hợp" />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Khóa học</th>
                  <th>Loại</th>
                  <th>Trình độ</th>
                  <th>Trạng thái</th>
                  <th>Bài học</th>
                  <th>Học viên</th>
                  <th>Thời hạn</th>
                  <th>Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {list.data!.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/admin/khoa-hoc/${c.id}`} className="row" style={{ color: 'var(--ink)', gap: 12 }}>
                        <span style={{ width: 72, flex: 'none', borderRadius: 6, overflow: 'hidden' }}>
                          <Thumb url={c.thumbnailUrl} label={c.parentCategoryName} id={c.id} className="mini" />
                        </span>
                        <span>
                          <b>{c.title}</b>
                          <div className="sub">{c.organizationName}</div>
                        </span>
                      </Link>
                    </td>
                    <td className="small">
                      {c.parentCategoryName} › {c.categoryName}
                    </td>
                    <td>{LEVEL_LABEL[c.level]}</td>
                    <td>
                      <div className="stack" style={{ gap: 4 }}>
                        {publishChip(c.publishStatus)}
                        <TimeStatusChip status={c.timeStatus} />
                      </div>
                    </td>
                    <td>
                      {c.publishedLessonCount}/{c.lessonCount}
                    </td>
                    <td>{formatNumber(c.enrollmentCount)}</td>
                    <td>{c.learningDurationDays} ngày</td>
                    <td className="small">{formatDate(c.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && (
          <div className="pager-a">
            <span>{formatNumber(list.data.totalItems)} khóa học</span>
            <Pager page={page} totalPages={list.data.totalPages} onChange={(p) => set('page', String(p))} />
          </div>
        )}
      </div>
    </AdminPage>
  );
}

// ============================================================================ form khóa học

const TABS: [string, string][] = [
  ['', 'Thông tin'],
  ['bai-hoc', 'Bài học'],
  ['hoc-vien', 'Học viên'],
  ['xep-hang', 'Xếp hạng'],
];

/** SCR-ADM-06 — FR-ADM-13..19. */
export function AdminCourseEdit() {
  const { id = '' } = useParams();
  const isNew = id === 'moi';
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') ?? '';
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'course', id], queryFn: () => api<CourseForm>(`/admin/courses/${id}`), enabled: !isNew });
  const lifecycle = useMutation({
    mutationFn: (action: string) => (action === 'delete' ? api(`/admin/courses/${id}`, { method: 'DELETE' }) : api(`/admin/courses/${id}/${action}`, { method: 'POST' })),
    onSuccess: (_d, action) => {
      if (action === 'delete') {
        toast('Đã xóa khóa học', 'info');
        nav('/admin/khoa-hoc');
        return;
      }
      toast({ publish: 'Đã xuất bản khóa học', restore: 'Đã khôi phục khóa học', unpublish: 'Đã gỡ về bản nháp', archive: 'Đã lưu trữ khóa học' }[action] ?? 'Đã cập nhật');
      qc.invalidateQueries({ queryKey: ['admin', 'course', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  if (!isNew && q.isLoading) return <Spinner />;
  if (!isNew && q.error) return <ErrorBox error={q.error} />;
  const c = q.data;
  return (
    <AdminPage
      crumbs={[['Quản trị', '/admin'], ['Khóa học', '/admin/khoa-hoc'], [isNew ? 'Tạo khóa học' : c!.title]]}
      title={
        <span className="stack" style={{ gap: 8 }}>
          {isNew ? 'Tạo khóa học' : c!.title}
          {c && (
            <span className="row" style={{ gap: 8, fontSize: 14, fontWeight: 500 }}>
              {publishChip(c.publishStatus)}
              <TimeStatusChip status={c.timeStatus} />
              <span className="small muted">
                {formatNumber(c.enrollmentCount)} học viên · cập nhật {formatDate(c.updatedAt)}
              </span>
            </span>
          )}
        </span>
      }
      actions={
        c && (
          <>
            <Link className="btn btn-light" to={`/khoa-hoc/${c.slug}`} target="_blank">
              <Icon name="eye" />
              Xem trước
            </Link>
            {c.publishStatus === 'DRAFT' && (
              <>
                <button
                  className="btn btn-light"
                  style={{ color: 'var(--error)' }}
                  onClick={async () => (await confirm({ title: 'Xóa khóa học nháp?', body: 'Toàn bộ bài học và quiz của khóa sẽ bị xóa.', confirmText: 'Xóa', danger: true, icon: 'trash' })).ok && lifecycle.mutate('delete')}
                >
                  <Icon name="trash" />
                  Xóa
                </button>
                <button className="btn btn-primary" onClick={() => lifecycle.mutate('publish')}>
                  <Icon name="upload" />
                  Xuất bản
                </button>
              </>
            )}
            {c.publishStatus === 'PUBLISHED' && (
              <>
                {c.enrollmentCount === 0 && (
                  <button className="btn btn-light" onClick={() => lifecycle.mutate('unpublish')}>
                    Gỡ về nháp
                  </button>
                )}
                <button
                  className="btn btn-outline"
                  onClick={async () =>
                    (
                      await confirm({
                        title: 'Lưu trữ khóa học?',
                        reference: 'FR-ADM-14 · BR-ADM-07',
                        tone: 'warn',
                        icon: 'folder',
                        confirmText: 'Lưu trữ',
                        body: (
                          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', fontSize: 14 }}>
                            <li>Khóa học bị ẩn khỏi tìm kiếm và không nhận ghi danh mới.</li>
                            <li>Học viên đã ghi danh vẫn xem lại được nội dung.</li>
                          </ul>
                        ),
                      })
                    ).ok && lifecycle.mutate('archive')
                  }
                >
                  Lưu trữ
                </button>
              </>
            )}
            {c.publishStatus === 'ARCHIVED' && (
              <button className="btn btn-primary" onClick={() => lifecycle.mutate('restore')}>
                <Icon name="refresh" />
                Khôi phục
              </button>
            )}
          </>
        )
      }
    >
      {!isNew && (
        <nav className="tabs">
          {TABS.map(([k, l]) => (
            <a key={k} className={tab === k ? 'active' : ''} onClick={() => setSp(k ? { tab: k } : {})}>
              {l}
              {k === 'hoc-vien' && c ? ` (${formatNumber(c.enrollmentCount)})` : ''}
            </a>
          ))}
        </nav>
      )}
      {tab === '' && <CourseInfoForm course={c} />}
      {tab === 'bai-hoc' && c && <CourseLessons courseId={c.id} hasLearners={c.enrollmentCount > 0} />}
      {tab === 'hoc-vien' && c && <CourseEnrollments courseId={c.id} />}
      {tab === 'xep-hang' && c && <CourseRanking courseId={c.id} />}
    </AdminPage>
  );
}

function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const vn = new Date(d.getTime() + 7 * 3600_000);
  return vn.toISOString().slice(0, 16);
}
function fromLocalInput(v: string) {
  if (!v) return null;
  return new Date(v + ':00+07:00').toISOString();
}

function CourseInfoForm({ course }: { course?: CourseForm }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const cats = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api<(CategoryNode & { isActive: boolean })[]>('/admin/categories') });
  const orgs = useQuery({ queryKey: ['admin', 'orgs', ''], queryFn: () => api<OrgItem[]>('/admin/organizations?q=') });
  const init = () => ({
    title: course?.title ?? '',
    slug: course?.slug ?? '',
    categoryId: course?.categoryId ? String(course.categoryId) : '',
    organizationId: course?.organizationId ? String(course.organizationId) : '',
    level: course?.level ?? 'BASIC',
    shortDescription: course?.shortDescription ?? '',
    description: course?.description ?? '',
    outcomes: course?.outcomes ?? '',
    targetAudience: course?.targetAudience ?? '',
    prerequisites: course?.prerequisites ?? '',
    thumbnailUrl: course?.thumbnailUrl ?? '',
    startDate: toLocalInput(course?.startDate),
    endDate: toLocalInput(course?.endDate),
    learningDurationDays: String(course?.learningDurationDays ?? 21),
    estimatedMinutes: course?.estimatedMinutes ? String(course.estimatedMinutes) : '',
    isFeatured: course?.isFeatured ?? false,
  });
  const [f, setF] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    setF(init());
  }, [course?.id, course?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...f,
        categoryId: f.categoryId ? Number(f.categoryId) : null,
        organizationId: f.organizationId ? Number(f.organizationId) : null,
        startDate: fromLocalInput(f.startDate),
        endDate: fromLocalInput(f.endDate),
        learningDurationDays: Number(f.learningDurationDays),
        estimatedMinutes: f.estimatedMinutes ? Number(f.estimatedMinutes) : null,
        thumbnailUrl: f.thumbnailUrl || null,
      };
      return course ? api(`/admin/courses/${course.id}`, { method: 'PUT', body }) : api<{ id: number }>('/admin/courses', { method: 'POST', body });
    },
    onSuccess: (r) => {
      setErrors({});
      toast('Đã lưu khóa học');
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
      if (course) qc.invalidateQueries({ queryKey: ['admin', 'course', String(course.id)] });
      else nav(`/admin/khoa-hoc/${(r as { id: number }).id}?tab=bai-hoc`);
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast(errorMessage(e), 'error');
    },
  });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const days = Number(f.learningDurationDays);
    // BR-LRN-09: thời hạn mới chỉ áp dụng cho lượt ghi danh mới và lượt học lại.
    if (course && days !== course.learningDurationDays && course.activeLearners > 0) {
      const r = await confirm({
        title: `Đổi thời hạn học ${course.learningDurationDays} → ${days} ngày?`,
        reference: 'FR-ADM-13 · BR-LRN-09',
        tone: 'warn',
        icon: 'hourglass',
        confirmText: 'Lưu thay đổi',
        body: (
          <>
            <p>
              Thời hạn mới chỉ áp dụng cho <b style={{ color: 'var(--ink)' }}>lượt ghi danh mới và lượt học lại</b>.
            </p>
            <p>
              <b style={{ color: 'var(--ink)' }}>{formatNumber(course.activeLearners)} học viên đang học</b> giữ nguyên hạn cũ ({course.learningDurationDays} ngày).
            </p>
          </>
        ),
      });
      if (!r.ok) return;
    }
    save.mutate();
  };
  const days = Number(f.learningDurationDays) || 0;
  const set = (k: keyof ReturnType<typeof init>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
      <div className="stack" style={{ gap: 24 }}>
        <div className="panel">
          <div className="panel-h">
            <h3>Thông tin chung</h3>
            <button className="btn btn-primary btn-sm" disabled={save.isPending}>
              <Icon name="check" size="sm" />
              {course ? 'Lưu thay đổi' : 'Tạo khóa học'}
            </button>
          </div>
          <div className="panel-b fgrid">
            <Field label="Tên khóa học" required error={errors.title} hint="5–200 ký tự" className="full">
              <input className="input" value={f.title} onChange={set('title')} maxLength={200} />
            </Field>
            <Field label="Slug" hint="Để trống để tự sinh" error={errors.slug}>
              <input className="input" value={f.slug} onChange={set('slug')} />
            </Field>
            <Field label="Trình độ" required>
              <select className="input" value={f.level} onChange={set('level')}>
                {Object.entries(LEVEL_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Loại khóa học (cấp 2)" required error={errors.categoryId}>
              <select className="input" value={f.categoryId} onChange={set('categoryId')}>
                <option value="">— Chọn loại —</option>
                {cats.data?.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    {c.children.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {c.name} › {ch.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Tổ chức đào tạo" required error={errors.organizationId}>
              <select className="input" value={f.organizationId} onChange={set('organizationId')}>
                <option value="">— Chọn tổ chức —</option>
                {orgs.data?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.isActive ? '' : ' (đã tắt)'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mô tả ngắn" required error={errors.shortDescription} hint={`${f.shortDescription.length} / 300 ký tự — hiển thị trên thẻ khóa học`} className="full">
              <input className="input" value={f.shortDescription} onChange={set('shortDescription')} maxLength={300} />
            </Field>
            <Field label="Mô tả chi tiết" required error={errors.description} className="full">
              <RichEditor value={f.description} onChange={(v) => setF((x) => ({ ...x, description: v }))} />
            </Field>
            <Field label="Mục tiêu đầu ra" className="full">
              <RichEditor small value={f.outcomes} onChange={(v) => setF((x) => ({ ...x, outcomes: v }))} />
            </Field>
            <Field label="Đối tượng phù hợp">
              <RichEditor small value={f.targetAudience} onChange={(v) => setF((x) => ({ ...x, targetAudience: v }))} />
            </Field>
            <Field label="Yêu cầu đầu vào">
              <RichEditor small value={f.prerequisites} onChange={(v) => setF((x) => ({ ...x, prerequisites: v }))} />
            </Field>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>Thời gian &amp; thời hạn học</h3>
          </div>
          <div className="panel-b stack" style={{ gap: 20 }}>
            <div className="fgrid">
              <Field label="Ngày bắt đầu" hint="Để trống = mở ngay">
                <input className="input" type="datetime-local" value={f.startDate} onChange={set('startDate')} />
              </Field>
              <Field label="Ngày kết thúc" error={errors.endDate} hint="Để trống = không kết thúc">
                <input className="input" type="datetime-local" value={f.endDate} onChange={set('endDate')} />
              </Field>
            </div>
            <div className="dur-box">
              <div className="row-between">
                <label className="bold" style={{ fontSize: 16 }} htmlFor="duration">
                  Thời hạn học (ngày) <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <span className="chip neutral">Mặc định: 21 ngày</span>
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <input id="duration" className="input num" type="number" min={1} max={365} value={f.learningDurationDays} onChange={set('learningDurationDays')} />
                <span className="bold">ngày</span>
                {days >= 7 && days % 7 === 0 && <span className="muted">= {days / 7} tuần</span>}
                <div className="row" style={{ marginLeft: 'auto', gap: 8, flexWrap: 'wrap' }}>
                  {[14, 21, 28, 42].map((d) => (
                    <button key={d} type="button" className={`chip outline${days === d ? ' on' : ''}`} onClick={() => setF({ ...f, learningDurationDays: String(d) })}>
                      {d / 7} tuần
                    </button>
                  ))}
                </div>
              </div>
              {errors.learningDurationDays && (
                <span className="err">
                  <Icon name="alert" size="sm" />
                  {errors.learningDurationDays}
                </span>
              )}
              <span className="hint">
                Số ngày mỗi người học được học kể từ khi đăng ký (1–365). Hết hạn mà chưa hoàn thành: khóa học đóng lại, dữ liệu học tập bị xóa và người học phải đăng ký học lại từ đầu.
              </span>
              {course && course.activeLearners > 0 && days !== course.learningDurationDays && (
                <div className="alert warn" style={{ fontSize: 14 }}>
                  <Icon name="alert" size="sm" />
                  <span>
                    Thời hạn mới chỉ áp dụng cho lượt ghi danh mới và lượt học lại. <b>{formatNumber(course.activeLearners)} học viên đang học</b> giữ nguyên hạn cũ ({course.learningDurationDays} ngày).
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="stack" style={{ gap: 24 }}>
        <div className="panel">
          <div className="panel-h">
            <h3>
              Ảnh bìa <span style={{ color: 'var(--error)' }}>*</span>
            </h3>
          </div>
          <div className="panel-b stack">
            <label className="upload-zone">
              {f.thumbnailUrl ? (
                <img src={f.thumbnailUrl} alt="Ảnh bìa" />
              ) : (
                <>
                  <Icon name="upload" size="lg" />
                  <b>Chọn ảnh bìa</b>
                </>
              )}
              <input
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const r = await uploadFile(file, 'COURSE_THUMBNAIL');
                    setF((x) => ({ ...x, thumbnailUrl: r.url }));
                  } catch (err) {
                    toast(errorMessage(err), 'error');
                  }
                }}
              />
            </label>
            <span className="xs muted">JPG, PNG, WebP ≤ 2MB · tỉ lệ 16:9. Bắt buộc trước khi xuất bản.</span>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h">
            <h3>Hiển thị</h3>
          </div>
          <div className="panel-b stack" style={{ gap: 16 }}>
            <div className="row-between">
              <div>
                <div className="bold small">Khóa học nổi bật</div>
                <div className="xs muted">Hiển thị trên trang chủ</div>
              </div>
              <Toggle on={f.isFeatured} label="Khóa học nổi bật" onChange={(v) => setF({ ...f, isFeatured: v })} />
            </div>
            <Field label="Thời lượng ước tính (phút)" hint="Để trống = tổng thời lượng các bài">
              <input className="input" type="number" min={0} value={f.estimatedMinutes} onChange={set('estimatedMinutes')} />
            </Field>
          </div>
        </div>
        {course && (
          <div className="panel">
            <div className="panel-h">
              <h3>Điều kiện xuất bản</h3>
            </div>
            <div className="panel-b stack" style={{ gap: 10 }}>
              {[
                [!!course.thumbnailUrl, 'Có ảnh bìa'],
                [course.publishedLessonCount > 0, `Có ít nhất 1 bài học đã xuất bản (${course.publishedLessonCount})`],
              ].map(([ok, t]) => (
                <div key={String(t)} className="row small">
                  <Icon name={ok ? 'check-circle' : 'x'} style={{ color: ok ? 'var(--success)' : 'var(--error)' }} />
                  {t}
                </div>
              ))}
              <div className="row small muted">
                <Icon name="info" size="sm" />
                Mọi quiz của bài đã xuất bản phải có câu hỏi hợp lệ
              </div>
            </div>
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={save.isPending}>
          <Icon name="check" />
          {course ? 'Lưu thay đổi' : 'Tạo khóa học'}
        </button>
      </div>
    </form>
  );
}

interface LessonRow {
  id: number;
  orderIndex: number;
  title: string;
  estimatedMinutes?: number;
  isPublished: boolean;
  quizId?: number;
  questionCount: number;
  openedCount: number;
  completedCount: number;
}

function CourseLessons({ courseId, hasLearners }: { courseId: number; hasLearners: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'lessons', courseId], queryFn: () => api<LessonRow[]>(`/admin/courses/${courseId}/lessons`) });
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const reorder = useMutation({
    mutationFn: (items: { id: number; orderIndex: number }[]) => api<LessonRow[]>(`/admin/courses/${courseId}/lessons/reorder`, { method: 'PUT', body: items }),
    onSuccess: (rows) => {
      qc.setQueryData(['admin', 'lessons', courseId], rows);
      toast('Đã cập nhật thứ tự bài học');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const create = useMutation({
    mutationFn: () => api<{ id: number }>(`/admin/courses/${courseId}/lessons`, { method: 'POST', body: { title: 'Bài học mới', isPublished: false } }),
    onSuccess: (r) => nav(`/admin/bai-hoc/${r.id}`),
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const rows = q.data!;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    const arr = [...rows];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    reorder.mutate(arr.map((l, i) => ({ id: l.id, orderIndex: i + 1 })));
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      {hasLearners && (
        <div className="alert warn">
          <Icon name="alert" />
          <span>Khóa học đã có học viên. Sắp xếp lại hoặc chèn bài mới sẽ ảnh hưởng thứ tự mở khóa bài của người đang học (BR-LRN-02).</span>
        </div>
      )}
      <div className="panel table-wrap">
        <div className="panel-h">
          <h3>Bài học ({rows.length})</h3>
          <button className="btn btn-primary btn-sm" onClick={() => create.mutate()}>
            <Icon name="plus" size="sm" />
            Thêm bài học
          </button>
        </div>
        {rows.length === 0 ? (
          <div className="panel-b">
            <Empty title="Khóa học chưa có bài học">Bấm "Thêm bài học" để bắt đầu.</Empty>
          </div>
        ) : (
          <table className="table compact">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Thứ tự</th>
                <th>Bài học</th>
                <th>Quiz</th>
                <th>Đã mở / xong</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((l, i) => (
                <tr
                  key={l.id}
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverId(l.id);
                  }}
                  onDragLeave={() => setOverId(null)}
                  onDrop={() => {
                    setOverId(null);
                    move(rows.findIndex((x) => x.id === dragId), i);
                  }}
                  style={{ boxShadow: overId === l.id ? 'inset 0 3px 0 var(--red)' : undefined }}
                >
                  <td>
                    <span className="row" style={{ gap: 4 }}>
                      <span className="drag-handle" title="Kéo để sắp xếp">
                        <Icon name="menu" size="sm" />
                      </span>
                      <b>{l.orderIndex}</b>
                      <button className="link-btn" onClick={() => move(i, i - 1)} aria-label="Lên" disabled={i === 0}>
                        ↑
                      </button>
                      <button className="link-btn" onClick={() => move(i, i + 1)} aria-label="Xuống" disabled={i === rows.length - 1}>
                        ↓
                      </button>
                    </span>
                  </td>
                  <td>
                    <Link className="bold" style={{ color: 'var(--ink)' }} to={`/admin/bai-hoc/${l.id}`}>
                      {l.title}
                    </Link>
                    {l.estimatedMinutes ? <div className="sub">{l.estimatedMinutes} phút</div> : null}
                  </td>
                  <td>{l.quizId ? <span className={`chip ${l.questionCount ? 'success' : 'warn'}`}>{l.questionCount} câu</span> : <span className="muted small">Không có</span>}</td>
                  <td className="small">
                    {formatNumber(l.openedCount)} / {formatNumber(l.completedCount)}
                  </td>
                  <td>{l.isPublished ? <span className="chip success">Đã xuất bản</span> : <span className="chip neutral">Nháp / ẩn</span>}</td>
                  <td>
                    <div className="acts">
                      <Link to={`/admin/bai-hoc/${l.id}`} aria-label="Sửa">
                        <Icon name="edit" size="sm" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface EnrollmentRow {
  userId: number;
  fullName: string;
  email: string;
  status: string;
  roundNo: number;
  progressPercent: number;
  enrolledAt: string;
  expiresAt: string;
  completedAt?: string;
  totalScore?: number;
  totalDurationSeconds?: number;
}

function CourseEnrollments({ courseId }: { courseId: number }) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ['admin', 'enrollments', courseId, status, dq, page],
    queryFn: () => api<Page<EnrollmentRow>>(`/admin/courses/${courseId}/enrollments${qs({ status, q: dq, page, size: 20 })}`),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="panel">
      <div className="toolbar-a">
        <div className="search-a">
          <Icon name="search" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm họ tên, email" style={{ border: 0, outline: 'none', font: 'inherit', flex: 1, background: 'transparent' }} />
        </div>
        <select className="dd" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Trạng thái">
          <option value="">Trạng thái: Tất cả</option>
          {Object.entries(ENROLL_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className="btn btn-light btn-sm" onClick={() => download(`/admin/courses/${courseId}/enrollments/export${qs({ status })}`, `hoc-vien-khoa-${courseId}.csv`)}>
          <Icon name="download" size="sm" />
          Xuất CSV
        </button>
      </div>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : (
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>Học viên</th>
                <th>Trạng thái</th>
                <th>Lần học</th>
                <th>Tiến độ</th>
                <th>Ghi danh</th>
                <th>Hạn học</th>
                <th>Điểm</th>
              </tr>
            </thead>
            <tbody>
              {q.data!.items.map((e) => (
                <tr key={e.userId}>
                  <td>
                    <b>{e.fullName}</b>
                    <div className="sub">{e.email}</div>
                  </td>
                  <td>
                    <span className={`chip ${e.status === 'COMPLETED' ? 'success' : e.status === 'EXPIRED' ? 'error' : e.status === 'CANCELLED' ? 'neutral' : 'warn'}`}>{ENROLL_STATUS_LABEL[e.status]}</span>
                  </td>
                  <td>{e.roundNo}</td>
                  <td>{e.status === 'EXPIRED' ? '—' : `${e.progressPercent}%`}</td>
                  <td className="small">{formatDate(e.enrolledAt)}</td>
                  <td className="small">{e.status === 'COMPLETED' ? `Xong ${formatDate(e.completedAt)}` : formatDateTime(e.expiresAt)}</td>
                  <td className="small">{e.totalScore !== undefined && e.totalScore !== null ? `${formatNumber(e.totalScore)} · ${formatClock(e.totalDurationSeconds ?? 0)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {q.data!.items.length === 0 && (
            <div className="panel-b">
              <Empty icon="users" title="Chưa có học viên" />
            </div>
          )}
        </div>
      )}
      {q.data && (
        <div className="pager-a">
          <span>{formatNumber(q.data.totalItems)} lượt ghi danh</span>
          <Pager page={page} totalPages={q.data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

function CourseRanking({ courseId }: { courseId: number }) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'ranking', courseId], queryFn: () => api<Page<RankingRow>>(`/admin/courses/${courseId}/ranking?size=50`) });
  const recalc = useMutation({
    mutationFn: () => api<{ message: string }>(`/admin/courses/${courseId}/ranking/recalculate`, { method: 'POST' }),
    onSuccess: (r) => {
      toast(r.message, 'info');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['admin', 'ranking', courseId] }), 3000);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <span className="small muted">Bảng xếp hạng đầy đủ (tên thật, kể cả học viên chọn ẩn danh với người khác).</span>
        <button
          className="btn btn-outline"
          onClick={async () =>
            (
              await confirm({
                title: 'Tính lại xếp hạng?',
                reference: 'FR-RNK-04',
                icon: 'refresh',
                confirmText: 'Tính lại',
                body: 'Hệ thống chấm lại toàn bộ lượt làm quiz của khóa học theo đáp án hiện tại và dựng lại bảng xếp hạng. Việc này chạy nền khoảng vài phút.',
              })
            ).ok && recalc.mutate()
          }
        >
          <Icon name="refresh" />
          Tính lại xếp hạng
        </button>
      </div>
      <RankingTable data={q.data} loading={q.isLoading} />
    </div>
  );
}
