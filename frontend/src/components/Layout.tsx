import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useAuth } from '@/auth/AuthContext';
import { initials } from '@/lib/format';

const LOGO = '/logo-256.png';

export function Brand({ sub = 'Trường ĐHSP Hà Nội 2' }: { sub?: string }) {
  return (
    <Link className="brand" to="/">
      <img src={LOGO} alt="Logo Trường Đại học Sư phạm Hà Nội 2" />
      <div>
        <div className="name">Bình Dân Học Vụ Số</div>
        <div className="sub">{sub}</div>
      </div>
    </Link>
  );
}

export function Avatar({ name, url, className = '' }: { name?: string; url?: string | null; className?: string }) {
  return <span className={`avatar ${className}`}>{url ? <img src={url} alt="" /> : initials(name)}</span>;
}

/** Cỡ chữ toàn trang (NFR-UX-02: có nút tăng cỡ chữ). Lưu trong trình duyệt. */
function useFontScale() {
  const [scale, setScale] = useState(() => {
    try {
      return Number(localStorage.getItem('fontScale') ?? 0);
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    // CSS dùng px nên phóng to cả trang bằng zoom (Chrome, Edge, Safari, Firefox 126+).
    document.body.style.zoom = ['', '1.08', '1.16'][scale] ?? '';
    try {
      localStorage.setItem('fontScale', String(scale));
    } catch {
      /* trình duyệt chặn lưu trữ */
    }
  }, [scale]);
  return [scale, setScale] as const;
}

function Header() {
  const { user, isAdmin, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [q, setQ] = useState('');
  const [scale, setScale] = useFontScale();
  const nav = useNavigate();
  const loc = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenu(false);
    setMobile(false);
  }, [loc.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const links: [string, string][] = [
    ['/', 'Trang chủ'],
    ['/khoa-hoc', 'Khóa học'],
    ['/bang-xep-hang', 'Bảng xếp hạng'],
    ...(user ? ([['/toi/khoa-hoc', 'Khóa học của tôi']] as [string, string][]) : []),
  ];
  const search = (e: FormEvent) => {
    e.preventDefault();
    nav(`/khoa-hoc${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <>
      <div className="topbar">
        <div className="container">
          <div className="row">
            <span>
              <Icon name="building" size="sm" />
              Trường Đại học Sư phạm Hà Nội 2 — Cổng học tập trực tuyến
            </span>
          </div>
          <div className="row">
            <span>
              <Icon name="phone" size="sm" />
              02113.863.416
            </span>
            <span>
              <Icon name="mail" size="sm" />
              dhsphn2@hpu2.edu.vn
            </span>
            <span>
              <Icon name="type" size="sm" />
              Cỡ chữ
              {[0, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  aria-pressed={scale === s}
                  aria-label={['Cỡ chữ thường', 'Cỡ chữ lớn', 'Cỡ chữ rất lớn'][s]}
                  style={{ background: 'none', border: 0, color: '#fff', fontWeight: scale === s ? 800 : 500, textDecoration: scale === s ? 'underline' : 'none', padding: '0 2px' }}
                >
                  {['A', 'A+', 'A++'][s]}
                </button>
              ))}
            </span>
          </div>
        </div>
      </div>
      <header className="header">
        <div className="container">
          <button className="icon-btn menu-btn" onClick={() => setMobile(!mobile)} aria-label="Mở menu" aria-expanded={mobile}>
            <Icon name="menu" />
          </button>
          <Brand />
          <nav className="nav" aria-label="Điều hướng chính">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                {label}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <span style={{ flex: 1 }} />
          ) : (
            <div className="search">
              <form onSubmit={search} role="search">
                <Icon name="search" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm khóa học, lĩnh vực, tổ chức đào tạo..." aria-label="Tìm khóa học" />
              </form>
            </div>
          )}
          <div className="actions">
            {user && (
              <Link className="icon-btn" to="/khoa-hoc" aria-label="Tìm khóa học">
                <Icon name="search" />
              </Link>
            )}
            {isAdmin && (
              <Link className="btn btn-primary btn-sm admin-entry" to="/admin">
                <Icon name="settings" size="sm" />
                Quản trị
              </Link>
            )}
            {user ? (
              <div className="user-menu" ref={ref}>
                <button className="user-chip" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu">
                  <Avatar name={user.fullName} url={user.avatarUrl} />
                  <div>
                    <div className="n">{user.fullName}</div>
                    <div className="r">{isAdmin ? 'Quản trị viên' : 'Người học'}</div>
                  </div>
                  <Icon name="chevron-down" size="sm" />
                </button>
                {menu && (
                  <div className="dropdown" role="menu">
                    <Link to="/toi/khoa-hoc">
                      <Icon name="book" size="sm" />
                      Khóa học của tôi
                    </Link>
                    <Link to="/toi/ho-so">
                      <Icon name="user" size="sm" />
                      Hồ sơ cá nhân
                    </Link>
                    {isAdmin && (
                      <Link to="/admin">
                        <Icon name="settings" size="sm" />
                        Trang quản trị
                      </Link>
                    )}
                    <button onClick={() => logout().then(() => nav('/'))} style={{ color: 'var(--error)' }}>
                      <Icon name="logout" size="sm" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link className="btn btn-light" to="/dang-nhap" state={{ from: loc.pathname + loc.search }}>
                  Đăng nhập
                </Link>
                <Link className="btn btn-primary" to="/dang-ky">
                  Đăng ký
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {mobile && (
        <nav className="mobile-nav" aria-label="Menu di động">
          <form onSubmit={search} role="search" style={{ marginBottom: 8 }}>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm khóa học..." aria-label="Tìm khóa học" />
          </form>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
            </NavLink>
          ))}
          {!user && <NavLink to="/dang-nhap">Đăng nhập</NavLink>}
        </nav>
      )}
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="cols">
          <div>
            <div className="brand-f">
              <div className="logo-bg">
                <img src={LOGO} alt="Logo HPU2" />
              </div>
              <div>
                <div className="name">Bình Dân Học Vụ Số</div>
                <div className="sub">Nền tảng học trực tuyến miễn phí của Trường ĐHSP Hà Nội 2</div>
              </div>
            </div>
            <div className="contact">
              <span>
                <Icon name="pin" size="sm" />
                32 Nguyễn Văn Linh, phường Xuân Hòa, tỉnh Phú Thọ
              </span>
              <span>
                <Icon name="phone" size="sm" />
                02113.863.416
              </span>
              <span>
                <Icon name="mail" size="sm" />
                dhsphn2@hpu2.edu.vn
              </span>
            </div>
          </div>
          <div>
            <h4>Khóa học</h4>
            <div className="links">
              <Link to="/khoa-hoc?category=ky-nang-so" style={{ color: 'inherit' }}>Kỹ năng số</Link>
              <Link to="/khoa-hoc?category=ngoai-ngu" style={{ color: 'inherit' }}>Ngoại ngữ</Link>
              <Link to="/khoa-hoc?category=su-pham-giao-duc" style={{ color: 'inherit' }}>Sư phạm &amp; giáo dục</Link>
              <Link to="/khoa-hoc" style={{ color: 'inherit' }}>Tất cả khóa học</Link>
            </div>
          </div>
          <div>
            <h4>Hỗ trợ</h4>
            <div className="links">
              <Link to="/huong-dan" style={{ color: 'inherit' }}>Hướng dẫn học trực tuyến</Link>
              <Link to="/huong-dan#cau-hoi" style={{ color: 'inherit' }}>Câu hỏi thường gặp</Link>
              <a href="mailto:dhsphn2@hpu2.edu.vn" style={{ color: 'inherit' }}>Liên hệ hỗ trợ</a>
            </div>
          </div>
          <div>
            <h4>Chính sách</h4>
            <div className="links">
              <Link to="/chinh-sach-du-lieu" style={{ color: 'inherit' }}>Chính sách bảo vệ dữ liệu cá nhân</Link>
              <Link to="/dieu-khoan" style={{ color: 'inherit' }}>Điều khoản sử dụng</Link>
            </div>
          </div>
        </div>
        <div className="copy">
          <span>© 2026 Trường Đại học Sư phạm Hà Nội 2. Bảo lưu mọi quyền.</span>
          <a href="https://www.hpu2.edu.vn/" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
            Website chính thức: hpu2.edu.vn
          </a>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const loc = useLocation();
  // Bọc trong {} để effect không trả về giá trị: tiện ích trình duyệt có thể ghi đè scrollTo và trả về thứ khác undefined
  // → React coi đó là hàm dọn dẹp và báo "destroy is not a function".
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <>
      <a href="#main" className="sr-only">
        Bỏ qua điều hướng
      </a>
      <Header />
      <main id="main" className="page">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export function PageHead({ crumbs, title, children }: { crumbs?: [string, string?][]; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="container">
        {crumbs && (
          <div className="crumb">
            {crumbs.map(([label, to], i) => (
              <span key={i} className="row" style={{ gap: 8 }}>
                {i > 0 && <Icon name="chevron-right" size="sm" />}
                {to ? <Link to={to} style={{ color: 'inherit' }}>{label}</Link> : <b>{label}</b>}
              </span>
            ))}
          </div>
        )}
        <h1 style={{ marginTop: crumbs ? 8 : 0 }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}
