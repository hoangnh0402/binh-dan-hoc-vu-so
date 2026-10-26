// Khung trang chi tiết khóa học (SCR-CRS-03): hero, thanh tab, cột phải theo trạng thái người học.
// Trang khai báo: <body data-tab="gioi-thieu|giao-trinh|danh-gia|chung-nhan|xep-hang"
//                       data-state="guest|enrolled|expired|completed">
// và đặt nội dung tab trong <div id="tab-content">. Nạp sau layout.js (dùng window.icon).
(function () {
  var icon = window.icon;
  var body = document.body;
  var tab = body.dataset.tab;
  var state = body.dataset.state;

  var hero =
    '<section class="c-hero"><div class="container"><div class="c-wrap"><div>' +
    '<div class="crumb"><span>Khóa học</span>' + icon('chevron-right', 'sm') + '<span>Kỹ năng số</span>' + icon('chevron-right', 'sm') + '<b>An toàn thông tin</b></div>' +
    '<h1>An toàn thông tin và phòng tránh lừa đảo trực tuyến</h1>' +
    '<p class="desc">Nhận diện các thủ đoạn lừa đảo phổ biến, bảo vệ tài khoản và dữ liệu cá nhân khi dùng Internet, mạng xã hội và ngân hàng số.</p>' +
    '<div class="row" style="margin-top:18px;gap:8px"><span class="chip">Kỹ năng số › An toàn thông tin</span><span class="chip">Cơ bản</span><span class="chip">Đang mở</span></div>' +
    '<div class="facts">' +
    '<span>' + icon('building', 'sm') + 'Khoa Công nghệ thông tin</span>' +
    '<span>' + icon('star', 'sm').replace('<svg ', '<svg style="color:var(--gold)" ') + '<b>4,9</b> (318 đánh giá)</span>' +
    '<span>' + icon('users', 'sm') + '1.952 người học</span>' +
    '<span>' + icon('book', 'sm') + '6 bài học · 4 giờ 30 phút</span>' +
    '<span>' + icon('calendar', 'sm') + 'Mở 01/09/2026 – 31/12/2026</span>' +
    '<span>' + icon('hourglass', 'sm') + 'Hoàn thành trong <b>3 tuần</b> kể từ khi đăng ký</span>' +
    '</div></div><div></div></div></div></section>';

  var tabs = [
    ['gioi-thieu', 'Giới thiệu', '24-chi-tiet-tab-gioi-thieu.html'],
    ['giao-trinh', 'Giáo trình', '03-chi-tiet-khoa-hoc.html'],
    ['danh-gia', 'Đánh giá (318)', '25-chi-tiet-tab-danh-gia.html'],
    ['chung-nhan', 'Chứng nhận', '26-chi-tiet-tab-chung-nhan.html'],
    ['xep-hang', 'Xếp hạng', '27-chi-tiet-tab-xep-hang.html']
  ].map(function (t) { return '<a href="' + t[2] + '"' + (t[0] === tab ? ' class="active"' : '') + '>' + t[1] + '</a>'; }).join('');

  var thumb = '<div class="thumb t2" style="padding:20px">' + icon('shield', 'big') + '<div class="t-label">Kỹ năng số</div></div>';
  var actions = {
    guest:
      '<div class="row-between"><span class="bold" style="font-size:22px;color:var(--red)">Miễn phí</span><span class="chip solid">Đang mở</span></div>' +
      '<div class="stack" style="gap:8px;font-size:15px"><span class="row">' + icon('book', 'sm') + '6 bài học, mỗi bài có quiz</span><span class="row">' + icon('clock', 'sm') + 'Khoảng 4 giờ 30 phút</span><span class="row">' + icon('hourglass', 'sm') + 'Hoàn thành trong 21 ngày kể từ khi đăng ký</span></div>' +
      '<a class="btn btn-primary btn-lg btn-block" href="04-dang-nhap.html">Đăng ký học</a>' +
      '<span class="xs muted" style="text-align:center">Bạn cần đăng nhập để đăng ký. Sau khi đăng nhập sẽ quay lại trang này.</span>',
    enrolled:
      '<div class="row-between"><span class="bold">Tiến độ của bạn</span><span class="bold" style="color:var(--red);font-size:20px">33%</span></div>' +
      '<div class="progress lg"><i style="width:33%"></i></div>' +
      '<div class="small muted">Đã hoàn thành 2/6 bài</div>' +
      '<div class="dl-box"><span class="deadline">' + icon('hourglass', 'sm') + 'Hạn học: 09:15 ngày 16/11/2026</span><span class="bold" style="font-size:18px">Còn 12 ngày 5 giờ</span>' +
      '<span class="xs muted">Hết hạn mà chưa hoàn thành, dữ liệu học tập sẽ bị xóa và bạn phải học lại từ đầu.</span></div>' +
      '<a class="btn btn-primary btn-lg btn-block">' + icon('play') + 'Tiếp tục học — Bài 3</a>' +
      '<a class="small muted" style="text-align:center">Hủy ghi danh</a>',
    expired:
      '<div class="alert error" style="font-size:14px">' + icon('alert', 'sm') + '<span><b>Thời hạn học đã kết thúc</b> lúc 09:15 ngày 20/10/2026. Tiến độ, điểm quiz và thứ hạng của lần học trước đã bị xóa.</span></div>' +
      '<div class="dl-box"><span class="small bold">Học lại từ đầu — lần học thứ 2</span><span class="xs muted">Bạn sẽ bắt đầu từ bài 1 và có 21 ngày để hoàn thành, tính từ lúc đăng ký lại.</span></div>' +
      '<a class="btn btn-primary btn-lg btn-block">' + icon('refresh') + 'Đăng ký học lại</a>',
    completed:
      '<div class="row-between"><span class="chip success">' + icon('check-circle', 'sm') + 'Đã hoàn thành</span><span class="bold" style="color:var(--success);font-size:20px">100%</span></div>' +
      '<div class="progress lg"><i style="width:100%;background:var(--success)"></i></div>' +
      '<div class="small muted">Hoàn thành ngày 30/10/2026 · 60 điểm · hạng #2</div>' +
      '<a class="btn btn-light btn-lg btn-block">' + icon('book') + 'Xem lại khóa học</a>'
  };

  var miniRank =
    '<div class="panel"><div class="panel-h"><h3>Xếp hạng khóa học</h3><a class="small bold" href="27-chi-tiet-tab-xep-hang.html">Xem tất cả</a></div>' +
    '<div class="panel-b mini-rank">' +
    '<div class="r"><span class="medal m1">1</span>Trần Thị B.<span class="sc">60 điểm<small>12:40</small></span></div>' +
    '<div class="r"><span class="medal m2">2</span>Lê Văn C.<span class="sc">60 điểm<small>14:05</small></span></div>' +
    '<div class="r"><span class="medal m3">3</span>Phạm Thu H.<span class="sc">58 điểm<small>11:20</small></span></div>' +
    (state === 'enrolled' ? '<div class="r" style="background:var(--red-tint);margin:6px -20px 0;padding:10px 20px"><span class="medal mx">27</span><b>Bạn</b><span class="sc">19 điểm<small>05:48</small></span></div>' : '') +
    '</div></div>';

  var content = document.getElementById('tab-content');
  var wrap = document.createElement('div');
  wrap.innerHTML = hero +
    '<div class="container c-wrap"><main class="c-main"><nav class="tabs">' + tabs + '</nav><div id="tab-slot"></div></main>' +
    '<aside class="c-side"><div class="c-action">' + thumb + '<div class="in">' + actions[state] + '</div></div>' +
    (tab === 'xep-hang' ? '' : miniRank) + '</aside></div>';
  body.insertBefore(wrap, content);
  document.getElementById('tab-slot').appendChild(content);
})();
