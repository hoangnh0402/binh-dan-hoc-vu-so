import { Link } from 'react-router-dom';
import { PageHead } from '@/components/Layout';
import { Icon } from '@/components/Icon';

/** NFR-PRV-01: trang Chính sách bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP). */
export function PrivacyPage() {
  return (
    <>
      <PageHead crumbs={[['Trang chủ', '/'], ['Chính sách bảo vệ dữ liệu cá nhân']]} title="Chính sách bảo vệ dữ liệu cá nhân" />
      <div className="container prose-html text-sm-prose" style={{ maxWidth: 860, padding: '32px 20px' }}>
        <p className="muted">Bản nháp — cần bộ phận pháp chế của Nhà trường rà soát trước khi phát hành chính thức.</p>
        <h2>1. Dữ liệu chúng tôi thu thập</h2>
        <ul>
          <li>Bắt buộc: họ tên, email, mật khẩu (lưu dạng băm, không ai đọc được).</li>
          <li>Không bắt buộc: năm sinh, quê quán, nơi công tác, số điện thoại, ảnh đại diện.</li>
          <li>Dữ liệu học tập: khóa học đã đăng ký, tiến độ, kết quả quiz, đánh giá.</li>
        </ul>
        <h2>2. Mục đích sử dụng</h2>
        <p>Cung cấp dịch vụ học tập, gửi mã xác thực và thông báo liên quan đến việc học, thống kê để cải thiện chất lượng khóa học. Chúng tôi không bán hoặc chia sẻ dữ liệu cá nhân cho bên thứ ba vì mục đích thương mại.</p>
        <h2>3. Thời hạn học và xóa dữ liệu học tập</h2>
        <p>
          Mỗi lượt đăng ký khóa học có thời hạn học (thường là 3 tuần). Hết thời hạn mà chưa hoàn thành, <b>tiến độ, lượt làm quiz và thứ hạng của lượt học đó sẽ bị xóa vĩnh viễn</b>; thông tin ghi danh (ngày đăng ký, số lần học) được giữ để thống kê.
        </p>
        <h2>4. Bảng xếp hạng</h2>
        <p>Bảng xếp hạng công khai chỉ hiện tên rút gọn với khách. Bạn có thể ẩn tên mình trong trang Hồ sơ.</p>
        <h2>5. Quyền của bạn</h2>
        <p>Bạn có quyền xem, sửa thông tin cá nhân trong trang Hồ sơ và yêu cầu xóa tài khoản bằng cách liên hệ quản trị viên qua email dhsphn2@hpu2.edu.vn.</p>
      </div>
    </>
  );
}

export function TermsPage() {
  return (
    <>
      <PageHead crumbs={[['Trang chủ', '/'], ['Điều khoản sử dụng']]} title="Điều khoản sử dụng" />
      <div className="container prose-html text-sm-prose" style={{ maxWidth: 860, padding: '32px 20px' }}>
        <p className="muted">Bản nháp — cần Nhà trường rà soát trước khi phát hành chính thức.</p>
        <ul>
          <li>Toàn bộ khóa học trên Bình Dân Học Vụ Số là miễn phí.</li>
          <li>Mỗi người dùng một tài khoản, không chia sẻ tài khoản cho người khác.</li>
          <li>Không đăng đánh giá có nội dung xúc phạm, quảng cáo, vi phạm pháp luật; quản trị viên có quyền ẩn đánh giá và khóa tài khoản vi phạm.</li>
          <li>Mỗi lượt học có thời hạn; hết hạn mà chưa hoàn thành thì phải học lại từ đầu.</li>
        </ul>
      </div>
    </>
  );
}

export function GuidePage() {
  return (
    <>
      <PageHead crumbs={[['Trang chủ', '/'], ['Hướng dẫn học trực tuyến']]} title="Hướng dẫn học trực tuyến" />
      <div className="container prose-html text-sm-prose" style={{ maxWidth: 860, padding: '32px 20px' }}>
        <h2>Các bước học</h2>
        <ol>
          <li>
            <Link to="/dang-ky">Đăng ký tài khoản</Link> và nhập mã xác thực gửi về email.
          </li>
          <li>Chọn khóa học, bấm "Đăng ký học". Hệ thống cho biết hạn chót hoàn thành.</li>
          <li>Học lần lượt từng bài: đọc/xem nội dung, làm đề bài thực hành, làm quiz. Đạt quiz thì bài sau được mở.</li>
          <li>Hoàn thành tất cả bài trước hạn để giữ kết quả và có tên trên bảng xếp hạng.</li>
        </ol>
        <h2 id="cau-hoi">Câu hỏi thường gặp</h2>
        <p>
          <b>Hết hạn học thì sao?</b> Tiến độ và điểm của lượt đó bị xóa, bạn có thể đăng ký học lại từ bài 1.
        </p>
        <p>
          <b>Làm quiz chưa đạt?</b> Bạn được làm lại; bảng xếp hạng tính lượt điểm cao nhất.
        </p>
        <p>
          <b>Chữ nhỏ khó đọc?</b> Bấm nút "A+" ở thanh trên cùng hoặc trong trang học để phóng to chữ.
        </p>
      </div>
    </>
  );
}

export function NotFoundPage() {
  return (
    <div className="center-box" style={{ minHeight: '60vh' }}>
      <Icon name="search" size="lg" style={{ color: 'var(--red)' }} />
      <h1 style={{ fontSize: 28 }}>Không tìm thấy trang</h1>
      <p className="muted">Đường dẫn có thể đã thay đổi hoặc không tồn tại.</p>
      <Link className="btn btn-primary" to="/">
        Về trang chủ
      </Link>
    </div>
  );
}
