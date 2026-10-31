import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { Progress } from './ui';
import type { CourseCard as Card } from '@/api/types';
import { deadlineLevel, durationLabel, formatDate, formatMinutes, formatNumber, formatRating, LEVEL_LABEL, remaining } from '@/lib/format';

const GRADIENTS = ['t1', 't2', 't3', 't4', 't5', 't6'];
const CATEGORY_ICON: Record<string, string> = {
  'Kỹ năng số': 'monitor',
  'Ngoại ngữ': 'message',
  'Sư phạm & giáo dục': 'book',
  'Kỹ năng mềm': 'users',
};

/** Ảnh bìa; khi chưa có ảnh thì dùng nền gradient đỏ–vàng như bản thiết kế. */
export function Thumb({ url, label, id, status, className = '' }: { url?: string; label: string; id: number; status?: React.ReactNode; className?: string }) {
  return (
    <div className={`thumb ${GRADIENTS[id % GRADIENTS.length]} ${className}`}>
      {url ? (
        <>
          <img className="cover" src={url} alt="" loading="lazy" />
          <span className="shade" />
        </>
      ) : (
        <>
          <Icon name={CATEGORY_ICON[label] ?? 'book'} className="big" />
          <div className="t-label">{label}</div>
        </>
      )}
      {status && <span className="status">{status}</span>}
    </div>
  );
}

export function TimeStatusChip({ status }: { status: string }) {
  if (status === 'UPCOMING') return <span className="chip gold">Sắp mở</span>;
  if (status === 'ENDED') return <span className="chip neutral">Đã kết thúc</span>;
  return <span className="chip solid">Đang mở</span>;
}

export function CourseCard({ c }: { c: Card }) {
  const e = c.myEnrollment;
  const to = `/khoa-hoc/${c.slug}`;
  let foot;
  if (e?.status === 'EXPIRED') {
    foot = (
      <div className="foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
        <span className="chip error" style={{ alignSelf: 'flex-start' }}>
          <Icon name="alert" size="sm" />
          Hết hạn {formatDate(e.expiresAt)}
        </span>
        <div className="xs muted">Dữ liệu học tập đã được xóa. Bạn cần học lại từ đầu.</div>
        <Link className="btn btn-outline btn-sm btn-block" to={to}>
          <Icon name="refresh" size="sm" />
          Đăng ký học lại
        </Link>
      </div>
    );
  } else if (e?.status === 'COMPLETED') {
    foot = (
      <div className="foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
        <div className="row-between">
          <span className="chip success">
            <Icon name="check-circle" size="sm" />
            Đã hoàn thành
          </span>
          <span className="xs bold">100%</span>
        </div>
        <Progress value={100} tone="success" />
        <Link className="btn btn-light btn-sm btn-block" to={`/hoc/${c.slug}`}>
          Xem lại khóa học
        </Link>
      </div>
    );
  } else if (e?.status === 'IN_PROGRESS') {
    const level = deadlineLevel(e.expiresAt);
    foot = (
      <div className="foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
        <div className="row-between">
          <span className="xs bold">Tiến độ {e.progressPercent}%</span>
          <span className={`deadline ${level === 'ok' ? '' : level === 'warn' ? 'warn' : 'danger'}`}>
            <Icon name="hourglass" size="sm" />
            Còn {remaining(e.expiresAt)}
          </span>
        </div>
        <Progress value={e.progressPercent} tone={level === 'ok' ? undefined : 'warn'} />
        <Link className="btn btn-primary btn-sm btn-block" to={`/hoc/${c.slug}`}>
          Tiếp tục học
        </Link>
      </div>
    );
  } else {
    foot = (
      <div className="foot">
        <span className="deadline">
          <Icon name="users" size="sm" />
          {formatNumber(c.enrollmentCount)} người học
        </span>
        <Link className="btn btn-ghost btn-sm" to={to}>
          Xem chi tiết
        </Link>
      </div>
    );
  }
  return (
    <article className="course-card">
      <Link to={to} style={{ color: 'inherit' }} aria-label={c.title}>
        <Thumb
          url={c.thumbnailUrl}
          label={c.parentCategoryName}
          id={c.id}
          status={
            <>
              <TimeStatusChip status={c.timeStatus} />
              <span className="chip neutral">{LEVEL_LABEL[c.level]}</span>
            </>
          }
        />
      </Link>
      <div className="body">
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <span className="chip ellipsis" title={c.categoryName}>{c.categoryName}</span>
          {c.ratingCount > 0 && (
            <span className="rating" style={{ marginLeft: 'auto', flexShrink: 0 }}>
              <Icon name="star" size="sm" />
              {formatRating(c.ratingAvg)}
            </span>
          )}
        </div>
        <h3 className="title">
          <Link to={to} style={{ color: 'inherit' }}>
            {c.title}
          </Link>
        </h3>
        <div className="org">
          <Icon name="building" size="sm" />
          {c.organizationName}
        </div>
        <div className="meta">
          <span>
            <Icon name="book" size="sm" />
            {c.publishedLessonCount} bài học
          </span>
          {c.estimatedMinutes ? (
            <span>
              <Icon name="clock" size="sm" />
              {formatMinutes(c.estimatedMinutes)}
            </span>
          ) : null}
          <span>
            <Icon name="hourglass" size="sm" />
            Học trong {durationLabel(c.learningDurationDays)}
          </span>
        </div>
      </div>
      {foot}
    </article>
  );
}

export function CardGridSkeleton({ n = 4 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="course-card" aria-hidden>
          <div className="skeleton" style={{ aspectRatio: '16/9', borderRadius: 0 }} />
          <div className="body">
            <div className="skeleton" style={{ height: 20, width: '40%' }} />
            <div className="skeleton" style={{ height: 44 }} />
            <div className="skeleton" style={{ height: 16, width: '70%' }} />
          </div>
        </div>
      ))}
    </>
  );
}
