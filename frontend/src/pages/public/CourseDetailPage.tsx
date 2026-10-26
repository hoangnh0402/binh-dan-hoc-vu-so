import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { CourseDetail, EnrollResult, LessonItem, MyRank, Page, RankingRow, ReviewPage } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Icon } from '@/components/Icon';
import { Thumb } from '@/components/CourseCard';
import { Avatar } from '@/components/Layout';
import { Empty, ErrorBox, Html, Modal, Pager, Progress, Spinner, Stars, errorMessage, useConfirm, useToast } from '@/components/ui';
import {
  deadlineLevel,
  durationLabel,
  formatClock,
  formatDate,
  formatDateTime,
  formatMinutes,
  formatNumber,
  formatRating,
  LEVEL_LABEL,
  remaining,
  TIME_STATUS_LABEL,
} from '@/lib/format';

const TABS: [string, string][] = [
  ['gioi-thieu', 'Giới thiệu'],
  ['giao-trinh', 'Giáo trình'],
  ['danh-gia', 'Đánh giá'],
  ['chung-nhan', 'Chứng nhận'],
  ['xep-hang', 'Xếp hạng'],
];

/** SCR-CRS-03 — FR-CRS-05..09, 11; FR-LRN-12. */
export default function CourseDetailPage() {
  const { slug = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const { user } = useAuth();
  const tab = sp.get('tab') ?? (user ? 'giao-trinh' : 'gioi-thieu');
  const q = useQuery({ queryKey: ['course', slug, user?.id], queryFn: () => api<CourseDetail>(`/courses/${slug}`) });

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data!;

  return (
    <>
      <section className="c-hero">
        <div className="container">
          <div className="c-wrap">
            <div>
              <div className="crumb">
                <Link to="/khoa-hoc" style={{ color: 'inherit' }}>Khóa học</Link>
                <Icon name="chevron-right" size="sm" />
                <Link to={`/khoa-hoc?category=${c.parentCategory.slug}`} style={{ color: 'inherit' }}>
                  {c.parentCategory.name}
                </Link>
                <Icon name="chevron-right" size="sm" />
                <b>{c.category.name}</b>
              </div>
              <h1>{c.title}</h1>
              <p className="desc">{c.shortDescription}</p>
              <div className="row" style={{ marginTop: 18, gap: 8, flexWrap: 'wrap' }}>
                <span className="chip">
                  {c.parentCategory.name} › {c.category.name}
                </span>
                <span className="chip">{LEVEL_LABEL[c.level]}</span>
                <span className="chip">{TIME_STATUS_LABEL[c.timeStatus]}</span>
                {c.publishStatus !== 'PUBLISHED' && <span className="chip">{c.publishStatus === 'ARCHIVED' ? 'Đã lưu trữ' : 'Bản nháp'}</span>}
              </div>
              <div className="facts">
                <span>
                  <Icon name="building" size="sm" />
                  {c.organization.name}
                </span>
                {c.ratingCount > 0 && (
                  <span>
                    <Icon name="star" size="sm" style={{ color: 'var(--gold)' }} />
                    <b>{formatRating(c.ratingAvg)}</b> ({formatNumber(c.ratingCount)} đánh giá)
                  </span>
                )}
                <span>
                  <Icon name="users" size="sm" />
                  {formatNumber(c.enrollmentCount)} người học
                </span>
                <span>
                  <Icon name="book" size="sm" />
                  {c.publishedLessonCount} bài học{c.estimatedMinutes ? ` · ${formatMinutes(c.estimatedMinutes)}` : ''}
                </span>
                {(c.startDate || c.endDate) && (
                  <span>
                    <Icon name="calendar" size="sm" />
                    {c.startDate ? `Mở ${formatDate(c.startDate)}` : 'Đang mở'}
                    {c.endDate ? ` – ${formatDate(c.endDate)}` : ''}
                  </span>
                )}
                <span>
                  <Icon name="hourglass" size="sm" />
                  Hoàn thành trong <b>{durationLabel(c.learningDurationDays)}</b> kể từ khi đăng ký
                </span>
              </div>
            </div>
            <div />
          </div>
        </div>
      </section>

      <div className="container c-wrap">
        <div className="c-main">
          <nav className="tabs" role="tablist">
            {TABS.map(([k, l]) => (
              <a
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={tab === k ? 'active' : ''}
                onClick={() => setSp(k === 'gioi-thieu' && !user ? {} : { tab: k }, { replace: true })}
              >
                {l}
                {k === 'danh-gia' && c.ratingCount > 0 ? ` (${c.ratingCount})` : ''}
              </a>
            ))}
          </nav>
          {tab === 'gioi-thieu' && <IntroTab c={c} />}
          {tab === 'giao-trinh' && <SyllabusTab c={c} />}
          {tab === 'danh-gia' && <ReviewsTab c={c} />}
          {tab === 'chung-nhan' && <CertificateTab c={c} />}
          {tab === 'xep-hang' && <RankingTab c={c} />}
        </div>
        <aside className="c-side">
          <ActionCard c={c} />
          {tab !== 'xep-hang' && <MiniRanking slug={c.slug} onAll={() => setSp({ tab: 'xep-hang' })} />}
        </aside>
      </div>
    </>
  );
}

// ======================================================================== cột phải

function ActionCard({ c }: { c: CourseDetail }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [success, setSuccess] = useState<EnrollResult | null>(null);
  const e = c.myEnrollment;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['course', c.slug] });
    qc.invalidateQueries({ queryKey: ['lessons', c.slug] });
    qc.invalidateQueries({ queryKey: ['my-courses'] });
  };
  const enroll = useMutation({
    mutationFn: () => api<EnrollResult>(`/courses/${c.slug}/enroll`, { method: 'POST' }),
    onSuccess: (r) => {
      setSuccess(r);
      refresh();
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });
  const cancel = useMutation({
    mutationFn: () => api<void>(`/courses/${c.slug}/enroll`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Đã hủy ghi danh. Bạn có thể đăng ký lại trước khi hết hạn để khôi phục tiến độ.', 'info');
      refresh();
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const goLearn = () => nav(`/hoc/${c.slug}`);
  const askCancel = async () => {
    const r = await confirm({
      title: 'Hủy ghi danh khóa học?',
      reference: 'FR-CRS-11',
      tone: 'warn',
      danger: true,
      icon: 'x',
      confirmText: 'Hủy ghi danh',
      cancelText: 'Tiếp tục học',
      body: (
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Bạn sẽ bị ẩn khỏi bảng xếp hạng của khóa học.</li>
          <li>
            Đăng ký lại trước <b>{formatDate(e?.expiresAt)}</b>: tiến độ được khôi phục.
          </li>
          <li>
            Hủy ghi danh <b>không dừng</b> thời hạn học. Sau ngày này, dữ liệu sẽ bị xóa.
          </li>
        </ul>
      ),
    });
    if (r.ok) cancel.mutate();
  };

  let body;
  if (!user) {
    body = (
      <>
        <div className="row-between">
          <span className="bold" style={{ fontSize: 22, color: 'var(--red)' }}>Miễn phí</span>
          <span className="chip solid">{TIME_STATUS_LABEL[c.timeStatus]}</span>
        </div>
        <Facts c={c} />
        <Link className="btn btn-primary btn-lg btn-block" to="/dang-nhap" state={{ from: loc.pathname }}>
          Đăng ký học
        </Link>
        <span className="xs muted" style={{ textAlign: 'center' }}>
          Bạn cần đăng nhập để đăng ký. Sau khi đăng nhập sẽ quay lại trang này.
        </span>
      </>
    );
  } else if (e?.status === 'IN_PROGRESS') {
    const level = deadlineLevel(e.expiresAt);
    const notStarted = new Date(e.learningStartedAt).getTime() > Date.now();
    body = (
      <>
        <div className="row-between">
          <span className="bold">Tiến độ của bạn</span>
          <span className="bold" style={{ color: 'var(--red)', fontSize: 20 }}>{e.progressPercent}%</span>
        </div>
        <Progress value={e.progressPercent} lg tone={level === 'ok' ? undefined : 'warn'} />
        <div className="small muted">
          Đã hoàn thành {e.completedLessonCount}/{c.publishedLessonCount} bài
        </div>
        <div className="dl-box">
          <span className={`deadline ${level === 'ok' ? '' : level === 'warn' ? 'warn' : 'danger'}`}>
            <Icon name="hourglass" size="sm" />
            Hạn học: {formatDateTime(e.expiresAt)}
          </span>
          <span className="bold" style={{ fontSize: 18 }}>Còn {remaining(e.expiresAt)}</span>
          <span className="xs muted">Hết hạn mà chưa hoàn thành, dữ liệu học tập sẽ bị xóa và bạn phải học lại từ đầu.</span>
        </div>
        {notStarted ? (
          <div className="alert info" style={{ fontSize: 14 }}>
            <Icon name="calendar" size="sm" />
            <span>Khóa học mở vào {formatDateTime(c.startDate)}. Bạn đã ghi danh trước, hãy quay lại khi đến ngày bắt đầu.</span>
          </div>
        ) : (
          <button className="btn btn-primary btn-lg btn-block" onClick={goLearn}>
            <Icon name="play" />
            {e.completedLessonCount > 0 ? 'Tiếp tục học' : 'Vào học'}
          </button>
        )}
        <button className="link-btn small" style={{ color: 'var(--ink-2)', fontWeight: 500, textAlign: 'center' }} onClick={askCancel}>
          Hủy ghi danh
        </button>
      </>
    );
  } else if (e?.status === 'COMPLETED') {
    body = (
      <>
        <div className="row-between">
          <span className="chip success">
            <Icon name="check-circle" size="sm" />
            Đã hoàn thành
          </span>
          <span className="bold" style={{ color: 'var(--success)', fontSize: 20 }}>{e.progressPercent}%</span>
        </div>
        <Progress value={e.progressPercent} lg tone="success" />
        <div className="small muted">Hoàn thành ngày {formatDate(e.completedAt)}. Kết quả và thứ hạng được lưu vĩnh viễn.</div>
        <button className="btn btn-light btn-lg btn-block" onClick={goLearn}>
          <Icon name="book" />
          Xem lại khóa học
        </button>
      </>
    );
  } else if (e?.status === 'EXPIRED') {
    body = (
      <>
        <div className="alert error" style={{ fontSize: 14 }}>
          <Icon name="alert" size="sm" />
          <span>
            <b>Thời hạn học đã kết thúc</b> lúc {formatDateTime(e.expiresAt)}. Tiến độ, điểm quiz và thứ hạng của lần học trước đã bị xóa.
          </span>
        </div>
        <div className="dl-box">
          <span className="small bold">Học lại từ đầu — lần học thứ {e.roundNo + 1}</span>
          <span className="xs muted">
            Bạn sẽ bắt đầu từ bài 1 và có {c.learningDurationDays} ngày để hoàn thành, tính từ lúc đăng ký lại.
          </span>
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={enroll.isPending || c.timeStatus === 'ENDED'} onClick={() => enroll.mutate()}>
          <Icon name="refresh" />
          Đăng ký học lại
        </button>
      </>
    );
  } else {
    const ended = c.timeStatus === 'ENDED';
    body = (
      <>
        <div className="row-between">
          <span className="bold" style={{ fontSize: 22, color: 'var(--red)' }}>Miễn phí</span>
          <span className="chip solid">{TIME_STATUS_LABEL[c.timeStatus]}</span>
        </div>
        <Facts c={c} />
        {e?.status === 'CANCELLED' && (
          <div className="alert info" style={{ fontSize: 14 }}>
            <Icon name="info" size="sm" />
            <span>Bạn đã hủy ghi danh. Đăng ký lại trước {formatDate(e.expiresAt)} để khôi phục tiến độ.</span>
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={ended || enroll.isPending} onClick={() => enroll.mutate()}>
          {ended ? 'Khóa học đã kết thúc' : e?.status === 'CANCELLED' ? 'Đăng ký lại' : 'Đăng ký học'}
        </button>
        {c.timeStatus === 'UPCOMING' && (
          <span className="xs muted" style={{ textAlign: 'center' }}>
            Khóa học mở ngày {formatDate(c.startDate)}. Thời hạn học tính từ ngày mở.
          </span>
        )}
      </>
    );
  }

  return (
    <div className="c-action">
      <Thumb url={c.thumbnailUrl} label={c.parentCategory.name} id={c.id} />
      <div className="in">{body}</div>
      <Modal open={!!success} onClose={() => setSuccess(null)}>
        {success && (
          <>
            <div className="b">
              <div className="hd">
                <span className="ic ok">
                  <Icon name="check-circle" />
                </span>
                <div>
                  <h3>{success.roundNo > 1 ? 'Đã đăng ký học lại' : 'Đăng ký học thành công'}</h3>
                </div>
                <button className="x" onClick={() => setSuccess(null)} aria-label="Đóng">
                  <Icon name="x" />
                </button>
              </div>
              <p>
                Bạn cần hoàn thành khóa học trước <b style={{ color: 'var(--ink)' }}>{formatDateTime(success.expiresAt)}</b> ({success.learningDurationDays} ngày). Bài 1 đã được mở khóa.
              </p>
              <div className="dl-box">
                <span className="deadline" style={{ whiteSpace: 'normal', alignItems: 'flex-start' }}>
                  <Icon name="hourglass" size="sm" />
                  Hết hạn mà chưa xong: dữ liệu học tập bị xóa, phải học lại từ đầu.
                </span>
              </div>
            </div>
            <div className="f">
              <button className="btn btn-light" onClick={() => setSuccess(null)}>
                Để sau
              </button>
              {new Date(success.learningStartedAt).getTime() <= Date.now() && (
                <button className="btn btn-primary" onClick={goLearn}>
                  Vào học ngay
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function Facts({ c }: { c: CourseDetail }) {
  return (
    <div className="stack" style={{ gap: 8, fontSize: 15 }}>
      <span className="row">
        <Icon name="book" size="sm" />
        {c.publishedLessonCount} bài học, có quiz kiểm tra
      </span>
      {c.estimatedMinutes ? (
        <span className="row">
          <Icon name="clock" size="sm" />
          Khoảng {formatMinutes(c.estimatedMinutes)}
        </span>
      ) : null}
      <span className="row">
        <Icon name="hourglass" size="sm" />
        Hoàn thành trong {c.learningDurationDays} ngày kể từ khi đăng ký
      </span>
    </div>
  );
}

function MiniRanking({ slug, onAll }: { slug: string; onAll: () => void }) {
  const { user } = useAuth();
  const top = useQuery({ queryKey: ['ranking', slug, 0, 3, user?.id], queryFn: () => api<Page<RankingRow>>(`/courses/${slug}/ranking?size=3`) });
  const me = useQuery({ queryKey: ['ranking-me', slug, user?.id], queryFn: () => api<MyRank>(`/courses/${slug}/ranking/me`), enabled: !!user });
  if (!top.data || top.data.items.length === 0) return null;
  return (
    <div className="panel">
      <div className="panel-h">
        <h3>Xếp hạng khóa học</h3>
        <button className="link-btn small" onClick={onAll}>
          Xem tất cả
        </button>
      </div>
      <div className="panel-b mini-rank">
        {top.data.items.map((r) => (
          <div key={r.userId} className="r">
            <span className={`medal m${r.rank <= 3 ? r.rank : 'x'}`}>{r.rank}</span>
            {r.displayName}
            <span className="sc">
              {formatNumber(r.totalScore)} điểm<small>{formatClock(r.totalDurationSeconds)}</small>
            </span>
          </div>
        ))}
        {me.data?.rank && me.data.rank > 3 && (
          <div className="r" style={{ background: 'var(--red-tint)', margin: '6px -20px 0', padding: '10px 20px' }}>
            <span className="medal mx">{me.data.rank}</span>
            <b>Bạn</b>
            <span className="sc">
              {formatNumber(me.data.totalScore)} điểm<small>{formatClock(me.data.totalDurationSeconds ?? 0)}</small>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ======================================================================== tab

function IntroTab({ c }: { c: CourseDetail }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <h2 className="t">Giới thiệu khóa học</h2>
      <Html html={c.description} className="prose-c prose-html text-sm-prose" />
      {c.outcomes && (
        <>
          <h2 className="t">Bạn sẽ học được gì?</h2>
          <Html html={c.outcomes} className="prose-c prose-html text-sm-prose" />
        </>
      )}
      {c.targetAudience && (
        <>
          <h2 className="t">Khóa học phù hợp với ai?</h2>
          <Html html={c.targetAudience} className="prose-c prose-html text-sm-prose" />
        </>
      )}
      {c.prerequisites && (
        <>
          <h2 className="t">Yêu cầu đầu vào</h2>
          <Html html={c.prerequisites} className="prose-c prose-html text-sm-prose" />
        </>
      )}
      <div className="alert info" style={{ marginTop: 28 }}>
        <Icon name="hourglass" />
        <span>
          <b>Thời hạn học {c.learningDurationDays} ngày.</b> Sau khi đăng ký, bạn cần hoàn thành {c.publishedLessonCount} bài trong {c.learningDurationDays} ngày. Quá hạn mà chưa xong, tiến độ và điểm sẽ bị xóa và bạn phải học lại từ đầu.
        </span>
      </div>
      <h2 className="t">Tổ chức đào tạo</h2>
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', padding: 20 }}>
        <span className="avatar" style={{ width: 64, height: 64, borderRadius: 16, fontSize: 18, flexShrink: 0 }}>
          {c.organization.logoUrl ? <img src={c.organization.logoUrl} alt="" style={{ borderRadius: 16 }} /> : <Icon name="building" size="lg" />}
        </span>
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <b style={{ fontSize: 18 }}>{c.organization.name}</b>
          <div className="small muted">{c.organization.courseCount} khóa học</div>
        </div>
        <Link className="btn btn-ghost btn-sm" to={`/khoa-hoc?organization=${c.organization.id}`}>
          Xem các khóa học
        </Link>
      </div>
    </div>
  );
}

function SyllabusTab({ c }: { c: CourseDetail }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['lessons', c.slug, user?.id], queryFn: () => api<LessonItem[]>(`/courses/${c.slug}/lessons`) });
  const enrolled = c.myEnrollment && ['IN_PROGRESS', 'COMPLETED'].includes(c.myEnrollment.status);
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const lessons = q.data!;
  const prev = (i: number) => lessons[i - 1]?.orderIndex;
  return (
    <>
      <div className="row-between" style={{ margin: '24px 0 14px' }}>
        <h2 style={{ fontSize: 22 }}>Giáo trình · {lessons.length} bài</h2>
        <span className="small muted">Hoàn thành bài trước để mở khóa bài sau</span>
      </div>
      <div className="card">
        {lessons.map((l, i) => {
          const st = enrolled ? l.state : undefined;
          const cls = st === 'COMPLETED' ? 'done' : st === 'IN_PROGRESS' || st === 'UNLOCKED' ? 'cur' : st === 'LOCKED' ? 'lock' : '';
          return (
            <div key={l.id} className={`lesson ${cls}`}>
              <span className="no">{st === 'COMPLETED' ? <Icon name="check" size="sm" /> : l.orderIndex}</span>
              <div>
                <div className="t">
                  Bài {l.orderIndex}. {l.title}
                </div>
                <div className="xs muted">
                  {st === 'COMPLETED'
                    ? `Đã hoàn thành${l.bestScorePercent !== undefined && l.bestScorePercent !== null ? ` · Quiz ${l.bestScorePercent}%` : ''}`
                    : st === 'LOCKED'
                      ? `Hoàn thành bài ${prev(i)} để mở khóa`
                      : st
                        ? 'Đang học'
                        : l.hasQuiz
                          ? 'Có quiz cuối bài'
                          : 'Bài đọc / thực hành'}
                </div>
              </div>
              <div className="s">
                {l.estimatedMinutes ? (
                  <span className="row" style={{ gap: 4 }}>
                    <Icon name="clock" size="sm" />
                    {l.estimatedMinutes} phút
                  </span>
                ) : null}
                {l.hasQuiz && st !== 'IN_PROGRESS' && st !== 'UNLOCKED' && <span className="chip success">Có quiz</span>}
                {st === 'LOCKED' && <Icon name="lock" />}
                {(st === 'IN_PROGRESS' || st === 'UNLOCKED') && c.myEnrollment?.status === 'IN_PROGRESS' && (
                  <button className="btn btn-primary btn-sm" onClick={() => nav(`/hoc/${c.slug}/bai/${l.id}`)}>
                    Học tiếp
                  </button>
                )}
                {st === 'COMPLETED' && (
                  <button className="btn btn-light btn-sm" onClick={() => nav(`/hoc/${c.slug}/bai/${l.id}`)}>
                    Xem lại
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!enrolled && <p className="small muted" style={{ marginTop: 12 }}>Đăng ký học để mở nội dung bài học.</p>}
    </>
  );
}

function ReviewsTab({ c }: { c: CourseDetail }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['reviews', c.slug, page, user?.id], queryFn: () => api<ReviewPage>(`/courses/${c.slug}/reviews?page=${page}&size=10`) });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      api(`/courses/${c.slug}/reviews${q.data?.myReview ? '/me' : ''}`, {
        method: q.data?.myReview ? 'PUT' : 'POST',
        body: { rating, comment },
      }),
    onSuccess: () => {
      toast('Đã lưu đánh giá. Cảm ơn bạn!');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['reviews', c.slug] });
      qc.invalidateQueries({ queryKey: ['course', c.slug] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: () => api(`/courses/${c.slug}/reviews/me`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Đã xóa đánh giá', 'info');
      qc.invalidateQueries({ queryKey: ['reviews', c.slug] });
      qc.invalidateQueries({ queryKey: ['course', c.slug] });
    },
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data!;
  const total = d.summary.count || 1;
  const startEdit = () => {
    setRating(d.myReview?.rating ?? 0);
    setComment(d.myReview?.comment ?? '');
    setEditing(true);
  };
  const showForm = d.canReview && (!d.myReview || editing);
  return (
    <>
      <div className="card reviews-sum">
        <div style={{ textAlign: 'center' }}>
          <div className="big">{formatRating(d.summary.average)}</div>
          <div style={{ margin: '8px 0 4px' }}>
            <Stars value={Number(d.summary.average)} />
          </div>
          <div className="small muted">{formatNumber(d.summary.count)} đánh giá</div>
        </div>
        <div className="dist">
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="r">
              <span className="row" style={{ gap: 4 }}>
                {s} <Icon name="star" size="sm" style={{ color: 'var(--gold)' }} />
              </span>
              <div className="bar">
                <i style={{ width: `${((d.summary.distribution[s] ?? 0) / total) * 100}%` }} />
              </div>
              <span className="muted">{d.summary.distribution[s] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="card write-review">
          <div className="row-between">
            <b style={{ fontSize: 17 }}>{d.myReview ? 'Sửa đánh giá của bạn' : 'Viết đánh giá của bạn'}</b>
            <span className="xs muted">Mỗi người 1 đánh giá cho mỗi khóa</span>
          </div>
          <div className="row" style={{ gap: 14 }}>
            <div className="star-pick" role="radiogroup" aria-label="Số sao">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" className={s <= rating ? 'on' : ''} onClick={() => setRating(s)} aria-label={`${s} sao`} role="radio" aria-checked={rating === s}>
                  <Icon name="star" />
                </button>
              ))}
            </div>
            <span className="bold">{rating ? `${rating} sao — ${['', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Rất tốt', 'Tuyệt vời'][rating]}` : 'Chọn số sao'}</span>
          </div>
          <textarea className="textarea" style={{ height: 100 }} value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} placeholder="Chia sẻ cảm nhận của bạn (không bắt buộc)" />
          <div className="row-between">
            <span className="xs muted">{comment.length} / 1000 ký tự</span>
            <div className="row">
              {editing && (
                <button className="btn btn-light" onClick={() => setEditing(false)}>
                  Hủy
                </button>
              )}
              <button className="btn btn-primary" disabled={!rating || save.isPending} onClick={() => save.mutate()}>
                Gửi đánh giá
              </button>
            </div>
          </div>
        </div>
      )}
      {!d.canReview && user && !d.myReview && (
        <div className="alert info" style={{ marginTop: 20 }}>
          <Icon name="info" />
          <span>Bạn có thể viết đánh giá sau khi đăng ký và hoàn thành ít nhất 1 bài học.</span>
        </div>
      )}
      {d.myReview && !editing && (
        <div className="card" style={{ padding: 20, marginTop: 20, background: 'var(--red-tint)' }}>
          <div className="row-between">
            <b>Đánh giá của bạn</b>
            <div className="row">
              {d.canReview && (
                <button className="btn btn-light btn-sm" onClick={startEdit}>
                  <Icon name="edit" size="sm" />
                  Sửa
                </button>
              )}
              <button
                className="btn btn-light btn-sm"
                onClick={async () => (await confirm({ title: 'Xóa đánh giá của bạn?', confirmText: 'Xóa', danger: true, icon: 'trash' })).ok && remove.mutate()}
              >
                <Icon name="trash" size="sm" />
                Xóa
              </button>
            </div>
          </div>
          <Stars value={d.myReview.rating} />
          {d.myReview.comment && <p style={{ marginTop: 6 }}>{d.myReview.comment}</p>}
        </div>
      )}

      <div className="row-between" style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 22 }}>Nhận xét của người học</h2>
        <span className="small muted">Mới nhất trước</span>
      </div>
      {d.items.length === 0 ? (
        <Empty icon="message" title="Chưa có nhận xét nào" />
      ) : (
        d.items.map((r) => (
          <div key={r.id} className="rv">
            <div className="hd">
              <Avatar name={r.authorName} url={r.authorAvatarUrl} className="sm" />
              <div>
                <b>{r.authorName}</b>
                <div>
                  <Stars value={r.rating} />
                </div>
              </div>
              <span className="xs muted" style={{ marginLeft: 'auto' }}>
                {formatDate(r.createdAt)}
              </span>
            </div>
            {r.comment && <p>{r.comment}</p>}
          </div>
        ))
      )}
      <Pager page={d.page} totalPages={d.totalPages} onChange={setPage} />
    </>
  );
}

function CertificateTab({ c }: { c: CourseDetail }) {
  let criteria: { minProgress?: number; minAvgScorePercent?: number } = {};
  try {
    criteria = c.certificateCriteria ? JSON.parse(c.certificateCriteria) : {};
  } catch {
    criteria = {};
  }
  return (
    <>
      <div className="alert info" style={{ marginTop: 24 }}>
        <Icon name="info" />
        <span>
          Chứng nhận PDF có mã xác minh sẽ được cấp từ <b>giai đoạn 2</b>. Hiện tại trang này giới thiệu điều kiện và mẫu chứng nhận.
        </span>
      </div>
      <h2 className="t">Điều kiện nhận chứng nhận</h2>
      <div className="stack">
        {[
          ['book', `Hoàn thành ${criteria.minProgress ?? 100}% bài học`, `Trong thời hạn học ${c.learningDurationDays} ngày`],
          ['target', `Điểm quiz trung bình từ ${criteria.minAvgScorePercent ?? 70}% trở lên`, 'Tính theo lượt làm có điểm cao nhất của mỗi bài'],
          ['shield', 'Có mã xác minh công khai', 'Bất kỳ ai cũng tra cứu được tính hợp lệ của chứng nhận qua mã in trên PDF'],
        ].map(([ic, t, s]) => (
          <div key={t} className="card row" style={{ padding: '16px 18px', gap: 14 }}>
            <span className="avatar" style={{ borderRadius: 12 }}>
              <Icon name={ic} />
            </span>
            <div>
              <b>{t}</b>
              <div className="small muted">{s}</div>
            </div>
          </div>
        ))}
      </div>
      <h2 className="t">Mẫu chứng nhận</h2>
      <div className="cert-sample">
        <div className="in">
          <span className="chip gold" style={{ position: 'absolute', right: 18, top: 18 }}>
            MẪU
          </span>
          <img src="/logo-256.png" alt="Logo Trường Đại học Sư phạm Hà Nội 2" />
          <span className="school">Trường Đại học Sư phạm Hà Nội 2</span>
          <h3>Chứng nhận hoàn thành</h3>
          <span className="muted">Chứng nhận học viên</span>
          <span className="name">Họ và tên học viên</span>
          <span className="muted" style={{ maxWidth: 520 }}>
            đã hoàn thành khóa học <b style={{ color: 'var(--ink)' }}>"{c.title}"</b> trên nền tảng Bình Dân Học Vụ Số
          </span>
        </div>
      </div>
    </>
  );
}

function RankingTab({ c }: { c: CourseDetail }) {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['ranking', c.slug, page, 20, user?.id], queryFn: () => api<Page<RankingRow>>(`/courses/${c.slug}/ranking?page=${page}&size=20`) });
  const me = useQuery({ queryKey: ['ranking-me', c.slug, user?.id], queryFn: () => api<MyRank>(`/courses/${c.slug}/ranking/me`), enabled: !!user });
  return (
    <>
      {user && (
        <div className="card row" style={{ padding: '18px 20px', marginTop: 24, background: 'var(--red-tint)', gap: 18 }}>
          {me.data?.rank ? (
            <>
              <span className={`medal m${me.data.rank <= 3 ? me.data.rank : 'x'}`} style={{ width: 48, height: 48, fontSize: 18 }}>
                {me.data.rank}
              </span>
              <div>
                <div className="small muted">Hạng của bạn</div>
                <b style={{ fontSize: 20 }}>
                  #{me.data.rank} / {formatNumber(me.data.totalRanked)} — {formatNumber(me.data.totalScore)} điểm — {formatClock(me.data.totalDurationSeconds ?? 0)}
                </b>
              </div>
            </>
          ) : (
            <span>
              <Icon name="trophy" size="sm" /> Hoàn thành quiz đầu tiên để có mặt trên bảng xếp hạng.
            </span>
          )}
        </div>
      )}
      <RankingTable data={q.data} loading={q.isLoading} />
      {q.data && <Pager page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} />}
      <div className="row small muted" style={{ marginTop: 14, alignItems: 'flex-start' }}>
        <Icon name="info" size="sm" />
        {user ? '' : 'Tên người học được rút gọn để bảo vệ quyền riêng tư. '}Điểm cao hơn xếp trên; bằng điểm thì ai làm nhanh hơn xếp trên. Lượt học hết hạn bị xóa khỏi bảng.
      </div>
    </>
  );
}

export function RankingTable({ data, loading }: { data?: Page<RankingRow>; loading?: boolean }) {
  if (loading) return <Spinner />;
  if (!data || data.items.length === 0) return <Empty icon="trophy" title="Chưa có ai trên bảng xếp hạng">Hãy là người đầu tiên hoàn thành quiz của khóa học này.</Empty>;
  return (
    <div className="panel table-wrap" style={{ marginTop: 20 }}>
      <table className="table compact">
        <thead>
          <tr>
            <th style={{ width: 70 }}>Hạng</th>
            <th>Người học</th>
            <th>Tổng điểm</th>
            <th>Tổng thời gian</th>
            <th>Quiz đã làm</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((r) => (
            <tr key={r.userId} className={r.me ? 'me' : ''}>
              <td>
                <span className={`medal m${r.rank <= 3 ? r.rank : 'x'}`}>{r.rank}</span>
              </td>
              <td>
                <div className="who">
                  <Avatar name={r.displayName} url={r.avatarUrl} className="sm" />
                  {r.me ? <b>Bạn — {r.displayName}</b> : r.displayName}
                </div>
              </td>
              <td className="bold">{formatNumber(r.totalScore)}</td>
              <td>{formatClock(r.totalDurationSeconds)}</td>
              <td>{r.completedQuizCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
