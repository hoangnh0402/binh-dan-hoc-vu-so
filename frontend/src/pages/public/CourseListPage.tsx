import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '@/api/client';
import type { CategoryNode, CourseCard as Card, FacetValue, Page } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Icon } from '@/components/Icon';
import { CardGridSkeleton, CourseCard } from '@/components/CourseCard';
import { PageHead } from '@/components/Layout';
import { Empty, ErrorBox, Pager, useDebounced } from '@/components/ui';

const SORTS: [string, string][] = [
  ['relevance', 'Phù hợp nhất'],
  ['newest', 'Mới nhất'],
  ['popular', 'Nhiều người học nhất'],
  ['rating', 'Đánh giá cao nhất'],
  ['title', 'Tên A → Z'],
];

function list(sp: URLSearchParams, key: string) {
  return (sp.get(key) ?? '').split(',').filter(Boolean);
}

/** SCR-CRS-02 — FR-CRS-01..04. */
export default function CourseListPage() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [qInput, setQInput] = useState(sp.get('q') ?? '');
  const [mobileFilters, setMobileFilters] = useState(false);
  const debouncedQ = useDebounced(qInput);

  const filters = {
    q: sp.get('q') ?? '',
    status: list(sp, 'status'),
    myStatus: list(sp, 'myStatus'),
    category: list(sp, 'category'),
    level: list(sp, 'level'),
    organization: list(sp, 'organization'),
    sort: sp.get('sort') ?? '',
    page: Number(sp.get('page') ?? 0),
  };

  const update = (patch: Record<string, string | string[] | number | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => {
      const s = Array.isArray(v) ? v.join(',') : v === null ? '' : String(v);
      if (s) next.set(k, s);
      else next.delete(k);
    });
    if (!('page' in patch)) next.delete('page');
    setSp(next);
  };

  useEffect(() => {
    if (debouncedQ !== (sp.get('q') ?? '')) update({ q: debouncedQ.trim() || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);
  useEffect(() => {
    setQInput(sp.get('q') ?? '');
  }, [sp]);

  const filterQs = qs({
    q: filters.q,
    status: filters.status,
    myStatus: user ? filters.myStatus : [],
    category: filters.category,
    level: filters.level,
    organization: filters.organization,
  });
  const courses = useQuery({
    queryKey: ['courses', filterQs, filters.sort, filters.page, user?.id],
    queryFn: () => api<Page<Card>>(`/courses${filterQs}${filterQs ? '&' : '?'}${qs({ sort: filters.sort, page: filters.page, size: 12 }).slice(1)}`),
    placeholderData: keepPreviousData,
  });
  const facets = useQuery({
    queryKey: ['facets', filterQs, user?.id],
    queryFn: () => api<{ groups: Record<string, FacetValue[]> }>(`/courses/facets${filterQs}`),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<CategoryNode[]>('/categories'), staleTime: 300_000 });
  const count = (group: string, value: string) => facets.data?.groups[group]?.find((f) => f.value === value)?.count;

  const toggle = (key: keyof typeof filters, value: string) => {
    const cur = filters[key] as string[];
    update({ [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
  };

  const labels = useMemo(() => {
    const m: Record<string, string> = {};
    categories.data?.forEach((c) => {
      m[c.slug] = c.name;
      c.children.forEach((ch) => (m[ch.slug] = ch.name));
    });
    facets.data?.groups.organization?.forEach((o) => (m['org:' + o.value] = o.label));
    return m;
  }, [categories.data, facets.data]);

  const active: [string, string, string][] = [
    ...filters.status.map((v) => ['status', v, { UPCOMING: 'Sắp mở', OPEN: 'Đang mở', ENDED: 'Đã kết thúc' }[v] ?? v] as [string, string, string]),
    ...(user ? filters.myStatus.map((v) => ['myStatus', v, { NOT_ENROLLED: 'Chưa đăng ký', IN_PROGRESS: 'Đang học', COMPLETED: 'Đã hoàn thành', EXPIRED: 'Hết hạn' }[v] ?? v] as [string, string, string]) : []),
    ...filters.category.map((v) => ['category', v, labels[v] ?? v] as [string, string, string]),
    ...filters.level.map((v) => ['level', v, { BASIC: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao' }[v] ?? v] as [string, string, string]),
    ...filters.organization.map((v) => ['organization', v, labels['org:' + v] ?? 'Tổ chức'] as [string, string, string]),
  ];

  const Opt = ({ k, v, label, sub }: { k: keyof typeof filters; v: string; label: string; sub?: boolean }) => {
    const on = (filters[k] as string[]).includes(v);
    const n = count(k === 'category' ? 'category' : (k as string), v);
    return (
      <button type="button" className={`opt${sub ? ' sub' : ''}`} onClick={() => toggle(k, v)} aria-pressed={on}>
        <span className={`box${on ? ' on' : ''}`}>{on && <Icon name="check" size="sm" />}</span>
        {sub ? label : <b style={{ fontWeight: k === 'category' ? 700 : 400 }}>{label}</b>}
        {n !== undefined && <span className="n">{n}</span>}
      </button>
    );
  };

  return (
    <>
      <PageHead crumbs={[['Trang chủ', '/'], ['Khóa học']]} title="Khóa học">
        <div className="row" style={{ marginTop: 16, maxWidth: 640 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icon name="search" style={{ position: 'absolute', left: 14, top: 14, color: 'var(--ink-3)' }} />
            <input className="input" style={{ paddingLeft: 44 }} value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Tìm theo tên khóa học, mô tả, tổ chức đào tạo (gõ không dấu cũng được)" aria-label="Từ khóa" maxLength={100} />
          </div>
        </div>
      </PageHead>
      <div className="container list-layout">
        <aside className={`filters${mobileFilters ? ' open' : ''}`} aria-label="Bộ lọc">
          <div className="fh">
            <span className="row" style={{ gap: 8 }}>
              <Icon name="filter" />
              Bộ lọc
            </span>
            <button className="link-btn small" onClick={() => setSp(new URLSearchParams(filters.q ? { q: filters.q } : {}))}>
              Xóa bộ lọc
            </button>
          </div>
          <div className="fg">
            <h4>Trạng thái khóa học</h4>
            <Opt k="status" v="UPCOMING" label="Sắp mở" />
            <Opt k="status" v="OPEN" label="Đang mở" />
            <Opt k="status" v="ENDED" label="Đã kết thúc" />
          </div>
          {user && (
            <div className="fg">
              <h4>Trạng thái học của tôi</h4>
              <Opt k="myStatus" v="NOT_ENROLLED" label="Chưa đăng ký" />
              <Opt k="myStatus" v="IN_PROGRESS" label="Đang học" />
              <Opt k="myStatus" v="COMPLETED" label="Đã hoàn thành" />
              <Opt k="myStatus" v="EXPIRED" label="Hết hạn" />
            </div>
          )}
          <div className="fg">
            <h4>Lĩnh vực</h4>
            {categories.data?.map((c) => (
              <div key={c.id} className="stack" style={{ gap: 10 }}>
                <Opt k="category" v={c.slug} label={c.name} />
                {(filters.category.includes(c.slug) || c.children.some((ch) => filters.category.includes(ch.slug))) &&
                  c.children.map((ch) => <Opt key={ch.id} k="category" v={ch.slug} label={ch.name} sub />)}
              </div>
            ))}
          </div>
          <div className="fg">
            <h4>Trình độ</h4>
            <Opt k="level" v="BASIC" label="Cơ bản" />
            <Opt k="level" v="INTERMEDIATE" label="Trung cấp" />
            <Opt k="level" v="ADVANCED" label="Nâng cao" />
          </div>
          <div className="fg">
            <h4>Tổ chức đào tạo</h4>
            {facets.data?.groups.organization?.map((o) => <Opt key={o.value} k="organization" v={o.value} label={o.label} />)}
          </div>
          {mobileFilters && (
            <div className="fg">
              <button className="btn btn-primary btn-block" onClick={() => setMobileFilters(false)}>
                Áp dụng ({courses.data?.totalItems ?? 0} khóa học)
              </button>
            </div>
          )}
        </aside>

        <section>
          <div className="toolbar">
            <div className="small muted" aria-live="polite">
              <b style={{ color: 'var(--ink)', fontSize: 18 }}>{courses.data?.totalItems ?? '…'}</b> khóa học phù hợp
            </div>
            <div className="row">
              <button className="btn btn-light btn-sm filter-toggle" onClick={() => setMobileFilters(true)}>
                <Icon name="filter" size="sm" />
                Bộ lọc{active.length ? ` (${active.length})` : ''}
              </button>
              <label className="sort">
                Sắp xếp:
                <select value={filters.sort || (filters.q ? 'relevance' : 'newest')} onChange={(e) => update({ sort: e.target.value })}>
                  {SORTS.filter(([v]) => v !== 'relevance' || filters.q).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {active.length > 0 && (
            <div className="active-filters">
              {active.map(([k, v, label]) => (
                <button key={k + v} className="chip outline on" onClick={() => toggle(k as keyof typeof filters, v)} aria-label={`Bỏ lọc ${label}`}>
                  {label}
                  <Icon name="x" size="sm" />
                </button>
              ))}
            </div>
          )}
          {courses.error ? (
            <ErrorBox error={courses.error} onRetry={() => courses.refetch()} />
          ) : courses.isLoading ? (
            <div className="grid-3">
              <CardGridSkeleton n={6} />
            </div>
          ) : courses.data!.items.length === 0 ? (
            <Empty icon="search" title="Không tìm thấy khóa học phù hợp">
              Hãy thử bỏ bớt bộ lọc hoặc tìm bằng từ khóa khác.
            </Empty>
          ) : (
            <div className="grid-3" style={{ opacity: courses.isFetching ? 0.6 : 1 }}>
              {courses.data!.items.map((c) => (
                <CourseCard key={c.id} c={c} />
              ))}
            </div>
          )}
          {courses.data && <Pager page={courses.data.page} totalPages={courses.data.totalPages} onChange={(p) => update({ page: p })} />}
        </section>
      </div>
    </>
  );
}
