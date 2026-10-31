import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Icon } from '@/components/Icon';
import { ErrorBox, Spinner } from '@/components/ui';
import { formatDateTime, formatNumber } from '@/lib/format';
import { AdminPage } from './AdminLayout';

interface Dashboard {
  stats: Record<string, number>;
  daily: { day: string; newUsers: number; enrollments: number }[];
  topCourses: { id: number; title: string; slug: string; enrollmentCount: number }[];
  recentAudit: { createdAt: string; actorName: string; actionType: string; entityType: string; entityId?: number }[];
}

export const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  LOCK: 'Khóa',
  UNLOCK: 'Mở khóa',
  PUBLISH: 'Xuất bản',
  UNPUBLISH: 'Gỡ xuất bản',
  ARCHIVE: 'Lưu trữ',
  RESTORE: 'Khôi phục',
  HIDE: 'Ẩn',
  SHOW: 'Hiện',
  ROLE_CHANGE: 'Đổi vai trò',
  RESET_PASSWORD: 'Gửi đặt lại mật khẩu',
  RECALCULATE_RANKING: 'Tính lại xếp hạng',
  IMPORT: 'Nhập dữ liệu',
  EXPORT: 'Xuất dữ liệu',
};
export const ENTITY_LABEL: Record<string, string> = {
  USER: 'Người dùng',
  COURSE: 'Khóa học',
  COURSE_CATEGORY: 'Loại khóa học',
  ORGANIZATION: 'Tổ chức',
  LESSON: 'Bài học',
  QUIZ: 'Quiz',
  QUESTION: 'Câu hỏi',
  COURSE_REVIEW: 'Đánh giá',
};
export function actionChip(a: string) {
  const cls = ['DELETE', 'LOCK', 'HIDE'].includes(a) ? 'error' : ['PUBLISH', 'RESTORE'].includes(a) ? 'solid' : a === 'RECALCULATE_RANKING' ? 'gold' : a === 'UNLOCK' || a === 'SHOW' ? 'success' : '';
  return <span className={`chip action ${cls}`}>{ACTION_LABEL[a] ?? a}</span>;
}

/** SCR-ADM-01 — FR-ADM-21. */
export default function AdminDashboard() {
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api<Dashboard>('/admin/dashboard') });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const s = d.stats;
  const max = Math.max(1, ...d.daily.map((x) => Math.max(x.enrollments, x.newUsers)));
  const topMax = Math.max(1, ...d.topCourses.map((c) => c.enrollmentCount));
  const rate = s.totalEnrollments ? ((s.completedEnrollments / s.totalEnrollments) * 100).toFixed(1).replace('.', ',') : '0';
  const card = (k: string, v: number, ic: string, sub: React.ReactNode, tone?: 'warn') => (
    <div className="stat">
      <div className="k">
        {k}
        <span className="ic" style={tone ? { background: 'var(--warn-tint)', color: 'var(--warn)' } : undefined}>
          <Icon name={ic} />
        </span>
      </div>
      <div className="v">{formatNumber(v)}</div>
      <div className="d" style={tone ? { color: 'var(--warn)' } : undefined}>
        {sub}
      </div>
    </div>
  );
  return (
    <AdminPage
      crumbs={[['Quản trị'], ['Dashboard']]}
      title="Tổng quan hệ thống"
      actions={
        <Link className="btn btn-primary" to="/admin/khoa-hoc/moi">
          <Icon name="plus" />
          Tạo khóa học
        </Link>
      }
    >
      <div className="grid-3" style={{ gap: 20 }}>
        {card('Tổng người dùng', s.totalUsers, 'users', `+${formatNumber(s.newUsers7d)} người dùng mới trong 7 ngày`)}
        {card('Khóa học đã xuất bản', s.publishedCourses, 'book', <span className="muted">{s.upcomingCourses} khóa sắp mở</span>)}
        {card('Tổng lượt ghi danh', s.totalEnrollments, 'layers', `+${formatNumber(s.newEnrollments30d)} trong 30 ngày`)}
        {card('Lượt hoàn thành khóa học', s.completedEnrollments, 'award', `Tỉ lệ hoàn thành ${rate}%`)}
        {card('Hết hạn học (30 ngày)', s.expiredEnrollments30d, 'hourglass', 'Dữ liệu học tập đã được xóa tự động', 'warn')}
        {card('Đánh giá 1–2 sao (7 ngày)', s.lowRatingReviews7d, 'message', <Link to="/admin/danh-gia?rating=1,2">Xem để kiểm duyệt</Link>)}
      </div>
      <div className="split" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 20 }}>
        <div className="panel">
          <div className="panel-h">
            <h3>Người dùng mới &amp; lượt ghi danh theo ngày</h3>
            <div className="leg">
              <span>
                <i style={{ background: 'var(--red)' }} />
                Lượt ghi danh
              </span>
              <span>
                <i style={{ background: 'var(--red-tint-2)' }} />
                Người dùng mới
              </span>
            </div>
          </div>
          <div className="panel-b">
            <div className="chart-bars" role="img" aria-label="Biểu đồ 30 ngày gần nhất">
              {d.daily.map((x) => (
                <div key={x.day} className="b" title={`${x.day}: ${x.enrollments} ghi danh, ${x.newUsers} người dùng mới`}>
                  <i className="u" style={{ height: `${(x.newUsers / max) * 100}%` }} />
                  <i className="e" style={{ height: `${(x.enrollments / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="axis">
              {[0, 7, 14, 21, 29].map((i) => (
                <span key={i}>{d.daily[i]?.day.slice(8, 10)}/{d.daily[i]?.day.slice(5, 7)}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h">
            <h3>Top 5 khóa học nhiều học viên</h3>
          </div>
          <div className="panel-b">
            {d.topCourses.map((c, i) => (
              <div key={c.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="medal mx" style={{ borderRadius: 8, width: 28, height: 28 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link className="small bold" style={{ color: 'var(--ink)' }} to={`/admin/khoa-hoc/${c.id}`}>
                    {c.title}
                  </Link>
                  <div className="progress" style={{ height: 6, marginTop: 6 }}>
                    <i style={{ width: `${(c.enrollmentCount / topMax) * 100}%` }} />
                  </div>
                </div>
                <b className="small">{formatNumber(c.enrollmentCount)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="panel table-wrap">
        <div className="panel-h">
          <h3>Thao tác quản trị gần đây</h3>
          <Link className="small bold" to="/admin/nhat-ky">
            Xem nhật ký
          </Link>
        </div>
        <table className="table compact">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Người thao tác</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
            </tr>
          </thead>
          <tbody>
            {d.recentAudit.map((a, i) => (
              <tr key={i}>
                <td>{formatDateTime(a.createdAt)}</td>
                <td>{a.actorName}</td>
                <td>{actionChip(a.actionType)}</td>
                <td>
                  {ENTITY_LABEL[a.entityType] ?? a.entityType}
                  {a.entityId ? ` #${a.entityId}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
