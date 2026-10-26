import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Layout';

const MENU: ([string] | [string, string, string])[] = [
  ['Tổng quan'],
  ['/admin', 'Dashboard', 'chart'],
  ['Quản lý'],
  ['/admin/nguoi-dung', 'Người dùng', 'users'],
  ['/admin/loai-khoa-hoc', 'Loại khóa học', 'layers'],
  ['/admin/to-chuc', 'Tổ chức đào tạo', 'building'],
  ['/admin/khoa-hoc', 'Khóa học', 'book'],
  ['/admin/danh-gia', 'Đánh giá', 'message'],
  ['Hệ thống'],
  ['/admin/nhat-ky', 'Nhật ký thao tác', 'file'],
];

/** Bố cục trang quản trị (SRS 06 §7): sidebar trái, header, vùng nội dung có breadcrumb. */
export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const { user, logout } = useAuth();
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  return (
    <div className="admin">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <Link className="brand" to="/admin">
          <span className="logo-bg">
            <img src="/logo-256.png" alt="Logo HPU2" />
          </span>
          <div>
            <div className="name">Bình Dân Học Vụ Số</div>
            <div className="sub">Trang quản trị</div>
          </div>
        </Link>
        {MENU.map((m) =>
          m.length === 1 ? (
            <div key={m[0]} className="grp">
              {m[0]}
            </div>
          ) : (
            <NavLink key={m[0]} to={m[0]} end={m[0] === '/admin'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={m[2]} />
              {m[1]}
            </NavLink>
          ),
        )}
        <div className="grp">Khác</div>
        <Link to="/">
          <Icon name="home" />
          Về trang người học
        </Link>
        <a onClick={() => logout()}>
          <Icon name="logout" />
          Đăng xuất
        </a>
      </aside>
      <div className="admin-main">
        <div className="admin-top">
          <button className="icon-btn admin-menu-btn" onClick={() => setOpen(!open)} aria-label="Mở menu">
            <Icon name="menu" />
          </button>
          <span style={{ flex: 1 }} />
          <div className="user-chip">
            <Avatar name={user?.fullName} url={user?.avatarUrl} />
            <div>
              <div className="n">{user?.fullName}</div>
              <div className="r">ADMIN</div>
            </div>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}

export function AdminPage({ crumbs, title, actions, children }: { crumbs: [string, string?][]; title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="admin-body">
      <div className="crumb">
        {crumbs.map(([l, to], i) => (
          <span key={i} className="row" style={{ gap: 8 }}>
            {i > 0 && <Icon name="chevron-right" size="sm" />}
            {to ? (
              <Link to={to} style={{ color: 'inherit' }}>
                {l}
              </Link>
            ) : (
              <b>{l}</b>
            )}
          </span>
        ))}
      </div>
      <div className="page-h" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h1>{title}</h1>
        {actions && <div className="row" style={{ flexWrap: 'wrap' }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}
