import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/api/client';
import { Icon } from '@/components/Icon';
import { uploadFile } from '@/components/RichEditor';
import { ErrorBox, Field, Modal, Spinner, Toggle, errorMessage, useConfirm, useToast } from '@/components/ui';
import { AdminPage } from './AdminLayout';

interface CategoryAdmin {
  id: number;
  parentId?: number;
  depth: number;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  sortOrder: number;
  isActive: boolean;
  courseCount: number;
  children: CategoryAdmin[];
}

const EMPTY = { parentId: '' as string | number, name: '', slug: '', description: '', isActive: true };

/** SCR-ADM-03 — FR-ADM-07..10. */
export function AdminCategories() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api<CategoryAdmin[]>('/admin/categories') });
  const [selected, setSelected] = useState<CategoryAdmin | null>(null);
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setErrors({});
    setError('');
    setF(selected ? { parentId: selected.parentId ?? '', name: selected.name, slug: selected.slug, description: selected.description ?? '', isActive: selected.isActive } : EMPTY);
  }, [selected]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, parentId: f.parentId === '' ? null : Number(f.parentId) };
      return selected ? api(`/admin/categories/${selected.id}`, { method: 'PUT', body }) : api('/admin/categories', { method: 'POST', body });
    },
    onSuccess: () => {
      toast(selected ? 'Đã lưu loại khóa học' : 'Đã tạo loại khóa học');
      refresh();
      if (!selected) setF(EMPTY);
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      setError(errorMessage(e));
    },
  });
  const toggleActive = useMutation({
    mutationFn: (c: CategoryAdmin) =>
      api(`/admin/categories/${c.id}`, { method: 'PUT', body: { parentId: c.parentId ?? null, name: c.name, slug: c.slug, description: c.description, isActive: !c.isActive } }),
    onSuccess: refresh,
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/admin/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Đã xóa loại khóa học', 'info');
      setSelected(null);
      refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const reorder = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) => api('/admin/categories/reorder', { method: 'PUT', body: items }),
    onSuccess: refresh,
  });

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const roots = q.data!;

  const drop = (target: CategoryAdmin, siblings: CategoryAdmin[]) => {
    if (dragId === null || dragId === target.id) return;
    const from = siblings.findIndex((s) => s.id === dragId);
    const to = siblings.findIndex((s) => s.id === target.id);
    if (from < 0 || to < 0) return toast('Chỉ sắp xếp được trong cùng cấp', 'info');
    const arr = [...siblings];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    reorder.mutate(arr.map((c, i) => ({ id: c.id, sortOrder: i + 1 })));
  };

  const node = (c: CategoryAdmin, siblings: CategoryAdmin[]) => {
    const isOpen = expanded[c.id] ?? true;
    return (
      <div key={c.id}>
        <div
          className={`tree-node${c.depth === 2 ? ' l2' : ''}${selected?.id === c.id ? ' sel' : ''}${!c.isActive ? ' off' : ''}${overId === c.id ? ' drag-over' : ''}`}
          draggable
          onDragStart={() => setDragId(c.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverId(c.id);
          }}
          onDragLeave={() => setOverId(null)}
          onDrop={() => {
            setOverId(null);
            drop(c, siblings);
          }}
          onClick={() => setSelected(c)}
        >
          <span className="drag-handle" title="Kéo để sắp xếp">
            <Icon name="menu" size="sm" />
          </span>
          {c.depth === 1 && (
            <button
              className="link-btn"
              style={{ color: 'var(--ink-2)' }}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded({ ...expanded, [c.id]: !isOpen });
              }}
              aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
            >
              <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size="sm" />
            </button>
          )}
          <span className={c.depth === 1 ? 'bold' : ''}>{c.name}</span>
          <span className="cnt">
            {!c.isActive && <span className="chip neutral">Đã tắt</span>}
            <span>
              {c.depth === 1 ? `${c.children.length} loại con · ` : ''}
              {c.courseCount} khóa
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <Toggle on={c.isActive} label={`Bật/tắt ${c.name}`} onChange={() => toggleActive.mutate(c)} />
            </span>
          </span>
        </div>
        {c.depth === 1 && isOpen && c.children.map((ch) => node(ch, c.children))}
      </div>
    );
  };

  return (
    <AdminPage
      crumbs={[['Quản trị', '/admin'], ['Loại khóa học']]}
      title="Loại khóa học"
      actions={
        <button className="btn btn-primary" onClick={() => setSelected(null)}>
          <Icon name="plus" />
          Thêm loại mới
        </button>
      }
    >
      <div className="alert info">
        <Icon name="info" />
        <span>
          Tối đa <b>2 cấp</b>. Khóa học chỉ gắn vào loại cấp 2. Kéo thả để sắp xếp thứ tự trong cùng cấp. Tắt một loại sẽ ẩn nó (và loại con) khỏi bộ lọc công khai.
        </span>
      </div>
      <div className="split" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        <div className="panel">{roots.map((r) => node(r, roots))}</div>
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            save.mutate();
          }}
        >
          <div className="panel-h">
            <h3>{selected ? 'Sửa loại khóa học' : 'Thêm loại khóa học'}</h3>
            {selected && <span className="chip neutral">Cấp {selected.depth}</span>}
          </div>
          <div className="panel-b stack" style={{ gap: 16 }}>
            <Field label="Loại cha (cấp 1)" hint="Để trống nếu là lĩnh vực cấp 1." error={errors.parentId}>
              <select className="input" value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })}>
                <option value="">— Không có (cấp 1) —</option>
                {roots
                  .filter((r) => r.id !== selected?.id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Tên" required error={errors.name}>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={150} />
            </Field>
            <Field label="Slug" hint="Để trống để tự sinh từ tên không dấu." error={errors.slug}>
              <input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
            </Field>
            <Field label="Mô tả">
              <textarea className="textarea" style={{ height: 90 }} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
            <div className="row-between">
              <span className="bold small">Đang hoạt động</span>
              <Toggle on={f.isActive} label="Đang hoạt động" onChange={(v) => setF({ ...f, isActive: v })} />
            </div>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={save.isPending || !f.name.trim()}>
                {selected ? 'Lưu' : 'Thêm'}
              </button>
              {selected && (
                <button
                  type="button"
                  className="btn btn-light"
                  style={{ color: 'var(--error)' }}
                  onClick={async () => (await confirm({ title: `Xóa "${selected.name}"?`, confirmText: 'Xóa', danger: true, icon: 'trash' })).ok && remove.mutate(selected.id)}
                >
                  <Icon name="trash" size="sm" />
                  Xóa
                </button>
              )}
            </div>
            {error && (
              <div className="alert error" style={{ fontSize: 14 }}>
                <Icon name="alert" size="sm" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </AdminPage>
  );
}

// ======================================================================= tổ chức đào tạo

interface OrgAdmin {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  website?: string;
  contactEmail?: string;
  description?: string;
  isActive: boolean;
  courseCount: number;
}

/** SCR-ADM-04 — FR-ADM-11. */
export function AdminOrganizations() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['admin', 'orgs', search], queryFn: () => api<OrgAdmin[]>(`/admin/organizations?q=${encodeURIComponent(search)}`) });
  const [editing, setEditing] = useState<OrgAdmin | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => api(`/admin/organizations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Đã xóa tổ chức', 'info');
      qc.invalidateQueries({ queryKey: ['admin', 'orgs'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <AdminPage
      crumbs={[['Quản trị', '/admin'], ['Tổ chức đào tạo']]}
      title={
        <>
          Tổ chức đào tạo <span className="muted" style={{ fontSize: 18, fontWeight: 600 }}>{q.data?.length ?? ''}</span>
        </>
      }
      actions={
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Icon name="plus" />
          Thêm tổ chức
        </button>
      }
    >
      <div className="panel">
        <div className="toolbar-a" style={{ borderBottom: 0 }}>
          <div className="search-a">
            <Icon name="search" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tổ chức đào tạo" style={{ border: 0, outline: 'none', font: 'inherit', flex: 1, background: 'transparent' }} />
          </div>
        </div>
      </div>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : (
        <div className="org-grid">
          {q.data!.map((o) => (
            <div key={o.id} className={`org-card${o.isActive ? '' : ' off'}`}>
              <div className="row">
                <span className="lg">{o.logoUrl ? <img src={o.logoUrl} alt="" /> : o.name.split(' ').map((w) => w[0]).slice(0, 3).join('').toUpperCase()}</span>
                <div style={{ minWidth: 0 }}>
                  <b>{o.name}</b>
                  <div className="xs muted">/{o.slug}</div>
                </div>
              </div>
              <div className="stack small muted" style={{ gap: 6 }}>
                <span className="row" style={{ gap: 8 }}>
                  <Icon name="book" size="sm" />
                  {o.courseCount} khóa học
                </span>
                <span className="row" style={{ gap: 8 }}>
                  <Icon name="mail" size="sm" />
                  {o.contactEmail ?? 'Chưa có email'}
                </span>
                <span className="row" style={{ gap: 8 }}>
                  <Icon name="globe" size="sm" />
                  {o.website ?? 'Chưa có website'}
                </span>
              </div>
              <div className="row-between" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                {o.isActive ? <span className="chip success">Hoạt động</span> : <span className="chip neutral">Đã tắt</span>}
                <div className="acts">
                  <a onClick={() => setEditing(o)} aria-label="Sửa">
                    <Icon name="edit" size="sm" />
                  </a>
                  {o.courseCount === 0 && (
                    <a className="danger" aria-label="Xóa" onClick={async () => (await confirm({ title: `Xóa tổ chức "${o.name}"?`, confirmText: 'Xóa', danger: true, icon: 'trash' })).ok && remove.mutate(o.id)}>
                      <Icon name="trash" size="sm" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="alert info">
        <Icon name="info" />
        <span>Tổ chức đang có khóa học không xóa được, chỉ có thể tắt hoạt động. Tổ chức bị tắt không xuất hiện trong bộ lọc ở trang người học.</span>
      </div>
      {editing && <OrgModal org={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </AdminPage>
  );
}

function OrgModal({ org, onClose }: { org: OrgAdmin | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    name: org?.name ?? '',
    slug: org?.slug ?? '',
    logoUrl: org?.logoUrl ?? '',
    website: org?.website ?? '',
    contactEmail: org?.contactEmail ?? '',
    description: org?.description ?? '',
    isActive: org?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => (org ? api(`/admin/organizations/${org.id}`, { method: 'PUT', body: f }) : api('/admin/organizations', { method: 'POST', body: f })),
    onSuccess: () => {
      toast('Đã lưu tổ chức');
      qc.invalidateQueries({ queryKey: ['admin', 'orgs'] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast(errorMessage(e), 'error');
    },
  });
  return (
    <Modal open onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="b">
          <div className="hd">
            <span className="ic brand">
              <Icon name="building" />
            </span>
            <h3>{org ? 'Sửa tổ chức đào tạo' : 'Thêm tổ chức đào tạo'}</h3>
          </div>
          <div className="fgrid">
            <Field label="Tên" required error={errors.name}>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Slug" hint="Để trống để tự sinh" error={errors.slug}>
              <input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
            </Field>
            <Field label="Email liên hệ" error={errors.contactEmail}>
              <input className="input" type="email" value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} />
            </Field>
            <Field label="Website" error={errors.website}>
              <input className="input" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" />
            </Field>
            <Field label="Logo" className="full">
              <div className="row">
                {f.logoUrl && <img src={f.logoUrl} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--line)' }} />}
                <label className="btn btn-light btn-sm">
                  <Icon name="upload" size="sm" />
                  Tải logo
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const r = await uploadFile(file, 'ORGANIZATION_LOGO');
                        setF((x) => ({ ...x, logoUrl: r.url }));
                      } catch (err) {
                        toast(errorMessage(err), 'error');
                      }
                    }}
                  />
                </label>
              </div>
            </Field>
            <Field label="Mô tả" className="full">
              <textarea className="textarea" style={{ height: 90 }} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
            <div className="row-between full">
              <span className="bold small">Đang hoạt động</span>
              <Toggle on={f.isActive} label="Đang hoạt động" onChange={(v) => setF({ ...f, isActive: v })} />
            </div>
          </div>
        </div>
        <div className="f">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" disabled={save.isPending || !f.name.trim()}>
            Lưu
          </button>
        </div>
      </form>
    </Modal>
  );
}
