// Phần dùng chung cho mọi màn hình: icon SVG, header, footer, sidebar quản trị.
// Cách dùng: <i data-i="search"></i>, <div data-header="guest|user" data-active="khoa-hoc"></div>,
// <div data-footer></div>, <aside data-sidebar data-active="khoa-hoc"></aside>
(function () {
  var LOGO = '../brand/logo-hpu2.png';

  var P = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    star: '<path class="f" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    play: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
    hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-8"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'
  };

  function svg(name, cls) {
    var body = P[name] || P.info;
    var filled = body.indexOf('class="f"') >= 0;
    return '<svg class="icon ' + (filled ? 'fill ' : '') + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  }
  window.icon = svg;

  function header(kind, active) {
    var nav = [
      ['trang-chu', 'Trang chủ', '01-trang-chu.html'],
      ['khoa-hoc', 'Khóa học', '02-danh-sach-khoa-hoc.html'],
      ['xep-hang', 'Bảng xếp hạng', '10-bang-xep-hang.html'],
      ['cua-toi', 'Khóa học của tôi', '09-khoa-hoc-cua-toi.html']
    ].filter(function (n) { return kind === 'user' || n[0] !== 'cua-toi'; })
     .map(function (n) { return '<a href="' + n[2] + '"' + (n[0] === active ? ' class="active"' : '') + '>' + n[1] + '</a>'; }).join('');

    var actions = kind === 'user'
      ? '<button class="icon-btn" aria-label="Thông báo">' + svg('bell') + '<span class="dot"></span></button>' +
        '<a class="user-chip" href="15-ho-so.html" style="color:inherit"><span class="avatar">NA</span><div><div class="n">Nguyễn Văn An</div><div class="r">Người học</div></div>' + svg('chevron-down', 'sm') + '</a>'
      : '<a class="btn btn-light" href="04-dang-nhap.html">Đăng nhập</a><a class="btn btn-primary" href="13-dang-ky.html">Đăng ký</a>';

    return '<div class="topbar"><div class="container">' +
      '<div class="row"><span>' + svg('building', 'sm') + 'Trường Đại học Sư phạm Hà Nội 2 — Cổng học tập trực tuyến</span></div>' +
      '<div class="row"><span>' + svg('phone', 'sm') + '02113.863.416</span><span>' + svg('mail', 'sm') + 'dhsphn2@hpu2.edu.vn</span><span>' + svg('type', 'sm') + 'Cỡ chữ A- A A+</span></div>' +
      '</div></div>' +
      '<header class="header"><div class="container">' +
      '<a class="brand" href="01-trang-chu.html"><img src="' + LOGO + '" alt="Logo Trường Đại học Sư phạm Hà Nội 2"><div><div class="name">Bình Dân Học Vụ Số</div><div class="sub">Trường ĐHSP Hà Nội 2</div></div></a>' +
      '<nav class="nav">' + nav + '</nav>' +
      (kind === 'user'
        ? '<div style="flex:1"></div><button class="icon-btn" aria-label="Tìm kiếm">' + svg('search') + '</button>'
        : '<div class="search">' + svg('search') + '<input placeholder="Tìm khóa học, lĩnh vực, tổ chức đào tạo..."></div>') +
      '<div class="actions">' + actions + '</div>' +
      '</div></header>';
  }

  function footer() {
    return '<footer class="footer"><div class="container"><div class="cols">' +
      '<div><div class="brand-f"><div class="logo-bg"><img src="' + LOGO + '" alt="Logo HPU2"></div><div><div class="name">Bình Dân Học Vụ Số</div><div class="sub">Nền tảng học trực tuyến miễn phí của Trường ĐHSP Hà Nội 2</div></div></div>' +
      '<div class="contact"><span>' + svg('pin', 'sm') + '32 Nguyễn Văn Linh, phường Xuân Hòa, tỉnh Phú Thọ</span><span>' + svg('phone', 'sm') + '02113.863.416</span><span>' + svg('mail', 'sm') + 'dhsphn2@hpu2.edu.vn</span></div></div>' +
      '<div><h4>Khóa học</h4><div class="links"><span>Kỹ năng số</span><span>Ngoại ngữ</span><span>Sư phạm &amp; giáo dục</span><span>Tất cả khóa học</span></div></div>' +
      '<div><h4>Hỗ trợ</h4><div class="links"><span>Hướng dẫn học trực tuyến</span><span>Câu hỏi thường gặp</span><span>Liên hệ hỗ trợ</span></div></div>' +
      '<div><h4>Chính sách</h4><div class="links"><span>Chính sách bảo vệ dữ liệu cá nhân</span><span>Điều khoản sử dụng</span><span>Quy chế học tập</span></div></div>' +
      '</div><div class="copy"><span>© 2026 Trường Đại học Sư phạm Hà Nội 2. Bảo lưu mọi quyền.</span><span>Website chính thức: hpu2.edu.vn</span></div></div></footer>';
  }

  function sidebar(active) {
    var items = [
      ['', 'Tổng quan'],
      ['dashboard', 'Dashboard', 'chart', '11-admin-dashboard.html'],
      ['', 'Quản lý'],
      ['nguoi-dung', 'Người dùng', 'users', '18-admin-nguoi-dung.html'],
      ['loai', 'Loại khóa học', 'layers', '19-admin-loai-khoa-hoc.html'],
      ['to-chuc', 'Tổ chức đào tạo', 'building', '20-admin-to-chuc.html'],
      ['khoa-hoc', 'Khóa học', 'book', '12-admin-form-khoa-hoc.html'],
      ['danh-gia', 'Đánh giá', 'message', '22-admin-danh-gia.html'],
      ['', 'Hệ thống'],
      ['nhat-ky', 'Nhật ký thao tác', 'file', '23-admin-nhat-ky.html']
    ].map(function (it) {
      if (!it[2]) return '<div class="grp">' + it[1] + '</div>';
      return '<a href="' + it[3] + '"' + (it[0] === active ? ' class="active"' : '') + '>' + svg(it[2]) + it[1] + '</a>';
    }).join('');
    return '<div class="brand"><div class="logo-bg"><img src="' + LOGO + '" alt="Logo HPU2"></div><div><div class="name">Bình Dân Học Vụ Số</div><div class="sub">Trang quản trị</div></div></div>' + items;
  }

  document.querySelectorAll('[data-header]').forEach(function (el) { el.outerHTML = header(el.dataset.header, el.dataset.active); });
  document.querySelectorAll('[data-footer]').forEach(function (el) { el.outerHTML = footer(); });
  document.querySelectorAll('[data-sidebar]').forEach(function (el) { el.innerHTML = sidebar(el.dataset.active); });
  document.querySelectorAll('i[data-i]').forEach(function (el) {
    var style = el.getAttribute('style');
    el.outerHTML = svg(el.dataset.i, el.className).replace('<svg ', style ? '<svg style="' + style + '" ' : '<svg ');
  });
})();
