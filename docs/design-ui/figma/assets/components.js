// Thẻ khóa học (FR-CRS-04): ảnh bìa, tên, tổ chức, lĩnh vực, trình độ, số bài, thời lượng,
// số người học, đánh giá, nhãn trạng thái; đã ghi danh → tiến độ + hạn học (FR-LRN-12).
// Phải nạp sau layout.js (dùng window.icon).
window.COURSES = [
  { t: 'Kỹ năng sử dụng máy tính và Internet cơ bản', org: 'Trung tâm Tin học HPU2', cat: 'Kỹ năng số', lvl: 'Cơ bản', les: 8, dur: '6 giờ', ppl: '2.418', rate: '4.8', th: 't1', ic: 'monitor', status: 'Đang mở' },
  { t: 'An toàn thông tin và phòng tránh lừa đảo trực tuyến', org: 'Khoa Công nghệ thông tin', cat: 'Kỹ năng số', lvl: 'Cơ bản', les: 6, dur: '4 giờ 30 phút', ppl: '1.952', rate: '4.9', th: 't2', ic: 'shield', status: 'Đang mở' },
  { t: 'Sử dụng dịch vụ công trực tuyến và VNeID', org: 'Trung tâm Tin học HPU2', cat: 'Kỹ năng số', lvl: 'Cơ bản', les: 5, dur: '3 giờ', ppl: '1.306', rate: '4.7', th: 't3', ic: 'globe', status: 'Đang mở' },
  { t: 'Tiếng Anh giao tiếp hằng ngày', org: 'Khoa Ngoại ngữ', cat: 'Ngoại ngữ', lvl: 'Trung cấp', les: 12, dur: '10 giờ', ppl: '986', rate: '4.6', th: 't4', ic: 'message', status: 'Đang mở' },
  { t: 'Ứng dụng AI trong dạy học phổ thông', org: 'Khoa Sư phạm', cat: 'Sư phạm & giáo dục', lvl: 'Nâng cao', les: 10, dur: '8 giờ', ppl: '742', rate: '4.9', th: 't5', ic: 'target', status: 'Sắp mở' },
  { t: 'Soạn thảo văn bản và bảng tính văn phòng', org: 'Trung tâm Tin học HPU2', cat: 'Kỹ năng số', lvl: 'Trung cấp', les: 9, dur: '7 giờ', ppl: '1.120', rate: '4.5', th: 't6', ic: 'file', status: 'Đang mở' },
  { t: 'Thiết kế bài giảng điện tử E-learning', org: 'Khoa Sư phạm', cat: 'Sư phạm & giáo dục', lvl: 'Trung cấp', les: 7, dur: '5 giờ', ppl: '615', rate: '4.7', th: 't2', ic: 'layers', status: 'Đang mở' },
  { t: 'Kỹ năng học tập suốt đời', org: 'Phòng Đào tạo', cat: 'Kỹ năng mềm', lvl: 'Cơ bản', les: 4, dur: '2 giờ 30 phút', ppl: '508', rate: '4.4', th: 't1', ic: 'book', status: 'Đã kết thúc' },
  { t: 'Thanh toán điện tử và mua sắm trực tuyến an toàn', org: 'Khoa Công nghệ thông tin', cat: 'Kỹ năng số', lvl: 'Cơ bản', les: 6, dur: '4 giờ', ppl: '874', rate: '4.6', th: 't6', ic: 'shield', status: 'Đang mở' },
  { t: 'Sử dụng điện thoại thông minh hiệu quả', org: 'Trung tâm Tin học HPU2', cat: 'Kỹ năng số', lvl: 'Cơ bản', les: 7, dur: '5 giờ', ppl: '1.733', rate: '4.8', th: 't4', ic: 'phone', status: 'Đang mở' }
];

window.courseCard = function (c, opt) {
  opt = opt || {};
  var icon = window.icon;
  var statusChip = c.status === 'Sắp mở' ? '<span class="chip gold">Sắp mở</span>'
    : c.status === 'Đã kết thúc' ? '<span class="chip neutral">Đã kết thúc</span>'
    : '<span class="chip solid">Đang mở</span>';
  var foot;
  if (opt.expired) {
    foot = '<div class="foot" style="flex-direction:column;align-items:stretch;gap:10px">' +
      '<span class="chip error" style="align-self:flex-start">' + icon('alert', 'sm') + 'Hết hạn ' + opt.expired + '</span>' +
      '<div class="xs muted">Dữ liệu học tập đã được xóa. Bạn cần học lại từ đầu.</div>' +
      '<a class="btn btn-outline btn-sm btn-block">' + icon('refresh', 'sm') + 'Đăng ký học lại</a></div>';
  } else if (opt.done) {
    foot = '<div class="foot" style="flex-direction:column;align-items:stretch;gap:10px">' +
      '<div class="row-between"><span class="chip success">' + icon('check-circle', 'sm') + 'Đã hoàn thành</span><span class="xs bold">100%</span></div>' +
      '<div class="progress"><i style="width:100%;background:var(--success)"></i></div>' +
      '<a class="btn btn-light btn-sm btn-block">Xem lại khóa học</a></div>';
  } else if (opt.progress != null) {
    var cls = opt.warn ? 'warn' : '';
    foot = '<div class="foot" style="flex-direction:column;align-items:stretch;gap:10px">' +
      '<div class="row-between"><span class="xs bold">Tiến độ ' + opt.progress + '%</span><span class="deadline ' + (opt.warn ? 'warn' : '') + '">' + icon('hourglass', 'sm') + 'Còn ' + opt.left + '</span></div>' +
      '<div class="progress ' + cls + '"><i style="width:' + opt.progress + '%"></i></div>' +
      '<a class="btn btn-primary btn-sm btn-block">Tiếp tục học</a></div>';
  } else {
    foot = '<div class="foot"><span class="deadline">' + icon('users', 'sm') + c.ppl + ' người học</span><a class="btn btn-ghost btn-sm">Xem chi tiết</a></div>';
  }
  return '<article class="course-card' + (opt.hover ? ' hover' : '') + '">' +
    '<div class="thumb ' + c.th + '"><span class="status">' + statusChip + '</span>' + icon(c.ic, 'big') + '<div class="t-label">' + c.cat + '</div></div>' +
    '<div class="body"><div class="row" style="gap:6px"><span class="chip neutral">' + c.lvl + '</span><span class="rating" style="margin-left:auto">' + icon('star', 'sm') + c.rate + '</span></div>' +
    '<h3 class="title">' + c.t + '</h3>' +
    '<div class="org">' + icon('building', 'sm') + c.org + '</div>' +
    '<div class="meta"><span>' + icon('book', 'sm') + c.les + ' bài học</span><span>' + icon('clock', 'sm') + c.dur + '</span><span>' + icon('hourglass', 'sm') + 'Học trong 3 tuần</span></div>' +
    '</div>' + foot + '</article>';
};
