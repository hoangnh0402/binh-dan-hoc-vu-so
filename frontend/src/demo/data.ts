// Dữ liệu khóa học mẫu cho chế độ DEMO (không cần backend).
// Nội dung mô phỏng thật để khách hàng xem trọn luồng học một khóa.

export type QType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';

export interface DQuestion {
  id: number;
  content: string;
  type: QType;
  points: number;
  options: { id: number; content: string }[];
  correctOptionIds: number[];
  explanation?: string;
}

export interface DQuiz {
  id: number;
  title: string;
  passScorePercent: number;
  timeLimitSeconds?: number;
  maxAttempts?: number;
  questions: DQuestion[];
}

export interface DLesson {
  id: number;
  orderIndex: number;
  title: string;
  estimatedMinutes: number;
  content: string;
  videoUrl?: string;
  assignment?: string;
  attachments?: { id: number; name: string; url: string; contentType: string; sizeBytes: number }[];
  quiz?: DQuiz;
}

export interface DReview {
  id: number;
  userId: number;
  authorName: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface DCourse {
  id: number;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  outcomes: string;
  targetAudience: string;
  prerequisites: string;
  level: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  learningDurationDays: number;
  categoryId: number;
  enrollmentCount: number;
  ratingAvg: number;
  ratingCount: number;
  featured?: boolean;
  lessons: DLesson[];
  reviews: DReview[];
  // Hạt giống bảng xếp hạng (các "người học khác" đã có điểm).
  ranking: { userId: number; name: string; totalScore: number; totalDurationSeconds: number; completedQuizCount: number }[];
}

export const ORG = {
  id: 1,
  name: 'Trường Đại học Sư phạm Hà Nội 2',
  slug: 'hpu2',
  description: 'Đơn vị chủ trì triển khai nền tảng Bình Dân Học Vụ Số.',
  courseCount: 3,
};

// Cây danh mục: cha → con
export const CATEGORIES = [
  {
    id: 1,
    name: 'Kỹ năng số',
    slug: 'ky-nang-so',
    children: [
      { id: 11, name: 'Tin học văn phòng', slug: 'tin-hoc-van-phong' },
      { id: 12, name: 'An toàn thông tin', slug: 'an-toan-thong-tin' },
    ],
  },
  {
    id: 2,
    name: 'Ngoại ngữ',
    slug: 'ngoai-ngu',
    children: [{ id: 21, name: 'Tiếng Anh', slug: 'tieng-anh' }],
  },
];

export function categoryOf(childId: number) {
  for (const p of CATEGORIES) {
    for (const c of p.children) if (c.id === childId) return { parent: p, child: c };
  }
  const p = CATEGORIES[0];
  return { parent: p, child: p.children[0] };
}

// ------------------------------------------------------------------ nội dung

const PASS = 70;

export const COURSES: DCourse[] = [
  {
    id: 1,
    slug: 'ky-nang-so-co-ban',
    title: 'Kỹ năng số cơ bản cho người dân',
    shortDescription:
      'Khóa học nhập môn giúp bạn tự tin sử dụng máy tính, Internet, email và dịch vụ công trực tuyến trong cuộc sống hằng ngày.',
    description:
      '<p>Trong thời đại số, mỗi người dân đều cần những kỹ năng số cơ bản để học tập, làm việc và tiếp cận dịch vụ công. Khóa học này được thiết kế cho người mới bắt đầu, trình bày dễ hiểu, có ví dụ thực tế và bài quiz củng cố sau mỗi bài.</p><p>Bạn sẽ đi từ những khái niệm đầu tiên về máy tính và Internet cho đến việc tự mình gửi email, nộp hồ sơ trực tuyến một cách an toàn.</p>',
    outcomes:
      '<ul><li>Hiểu và thao tác cơ bản với máy tính, trình duyệt web.</li><li>Tìm kiếm thông tin trên Internet hiệu quả và an toàn.</li><li>Tạo và sử dụng email để giao tiếp, nhận thông báo.</li><li>Thực hiện được một số thủ tục dịch vụ công trực tuyến.</li></ul>',
    targetAudience:
      '<p>Người dân ở mọi lứa tuổi mới làm quen với máy tính và Internet; cán bộ, công chức cần kỹ năng số nền tảng.</p>',
    prerequisites: '<p>Không yêu cầu kiến thức trước. Chỉ cần một máy tính hoặc điện thoại có kết nối Internet.</p>',
    level: 'BASIC',
    learningDurationDays: 21,
    categoryId: 11,
    enrollmentCount: 1284,
    ratingAvg: 4.7,
    ratingCount: 213,
    featured: true,
    ranking: [
      { userId: 9001, name: 'Nguyễn Thị Lan', totalScore: 15, totalDurationSeconds: 742, completedQuizCount: 3 },
      { userId: 9002, name: 'Trần Văn Minh', totalScore: 14, totalDurationSeconds: 690, completedQuizCount: 3 },
      { userId: 9003, name: 'Phạm Thu Hà', totalScore: 13, totalDurationSeconds: 905, completedQuizCount: 3 },
      { userId: 9004, name: 'Lê Hoàng Nam', totalScore: 11, totalDurationSeconds: 880, completedQuizCount: 2 },
      { userId: 9005, name: 'Đỗ Minh Châu', totalScore: 9, totalDurationSeconds: 1020, completedQuizCount: 2 },
    ],
    reviews: [
      { id: 1, userId: 9001, authorName: 'Nguyễn Thị Lan', rating: 5, comment: 'Khóa học rất dễ hiểu, mẹ tôi 60 tuổi cũng theo được. Cảm ơn thầy cô!', createdAt: '2026-10-10T09:00:00Z' },
      { id: 2, userId: 9002, authorName: 'Trần Văn Minh', rating: 5, comment: 'Phần dịch vụ công trực tuyến thực sự hữu ích, tôi đã tự nộp hồ sơ được.', createdAt: '2026-10-08T14:20:00Z' },
      { id: 3, userId: 9003, authorName: 'Phạm Thu Hà', rating: 4, comment: 'Nội dung tốt, mong có thêm video minh họa.', createdAt: '2026-10-05T08:10:00Z' },
    ],
    lessons: [
      {
        id: 101,
        orderIndex: 1,
        title: 'Làm quen với máy tính và Internet',
        estimatedMinutes: 15,
        videoUrl: 'https://www.youtube.com/watch?v=inWWhr5tnEA',
        content:
          '<h2>Máy tính là gì?</h2><p>Máy tính là thiết bị điện tử giúp bạn soạn thảo văn bản, xem thông tin, liên lạc và sử dụng nhiều dịch vụ trực tuyến. Có nhiều loại: máy tính để bàn, máy tính xách tay (laptop), máy tính bảng và điện thoại thông minh.</p><h3>Các bộ phận cơ bản</h3><ul><li><b>Màn hình</b>: hiển thị nội dung.</li><li><b>Bàn phím</b>: nhập chữ và số.</li><li><b>Chuột / cảm ứng</b>: trỏ và chọn.</li></ul><h2>Internet là gì?</h2><p>Internet là mạng lưới kết nối hàng tỷ thiết bị trên toàn thế giới, cho phép bạn truy cập thông tin và dịch vụ ở bất cứ đâu. Để vào Internet, bạn cần một kết nối (Wi-Fi hoặc mạng di động) và một <b>trình duyệt web</b>.</p><div class="alert info"><p>Mẹo: Hãy bắt đầu chậm rãi. Mỗi thao tác chỉ cần làm đúng một lần là bạn sẽ quen dần.</p></div>',
      },
      {
        id: 102,
        orderIndex: 2,
        title: 'Sử dụng trình duyệt web an toàn',
        estimatedMinutes: 20,
        content:
          '<h2>Trình duyệt web</h2><p>Trình duyệt là phần mềm giúp bạn mở các trang web. Phổ biến nhất là Google Chrome, Microsoft Edge, Cốc Cốc và Firefox.</p><h3>Thanh địa chỉ</h3><p>Đây là nơi bạn gõ địa chỉ trang web (ví dụ <code>dichvucong.gov.vn</code>) hoặc từ khóa tìm kiếm. Hãy để ý biểu tượng <b>ổ khóa</b> và chữ <b>https</b> ở đầu địa chỉ — đó là dấu hiệu kết nối được mã hóa, an toàn hơn.</p><h3>Tìm kiếm thông tin</h3><p>Dùng công cụ tìm kiếm như Google: gõ từ khóa ngắn gọn, rõ ràng. Ví dụ, thay vì gõ cả câu dài, hãy gõ "lịch tiêm chủng trẻ em 2026".</p><h2>An toàn khi duyệt web</h2><ul><li>Không bấm vào quảng cáo lạ hứa hẹn trúng thưởng.</li><li>Chỉ tải phần mềm từ trang chính thức.</li><li>Cảnh giác với trang yêu cầu nhập mật khẩu ngân hàng.</li></ul>',
        assignment:
          '<p>Hãy mở trình duyệt và thử:</p><ol><li>Truy cập trang <b>dichvucong.gov.vn</b> và quan sát biểu tượng ổ khóa.</li><li>Tìm kiếm "giờ làm việc UBND xã" của địa phương bạn.</li></ol><p>Bài thực hành này không cần nộp.</p>',
        quiz: {
          id: 1002,
          title: 'Quiz: Duyệt web an toàn',
          passScorePercent: PASS,
          timeLimitSeconds: 600,
          questions: [
            {
              id: 10201,
              content: 'Dấu hiệu nào cho thấy kết nối tới một trang web được mã hóa, an toàn hơn?',
              type: 'SINGLE_CHOICE',
              points: 1,
              options: [
                { id: 1020101, content: 'Địa chỉ bắt đầu bằng https và có biểu tượng ổ khóa' },
                { id: 1020102, content: 'Trang có nhiều hình ảnh đẹp' },
                { id: 1020103, content: 'Trang tải rất nhanh' },
                { id: 1020104, content: 'Trang có nhiều quảng cáo' },
              ],
              correctOptionIds: [1020101],
              explanation: 'Chữ "https" và biểu tượng ổ khóa cho biết dữ liệu giữa bạn và trang web được mã hóa.',
            },
            {
              id: 10202,
              content: 'Đâu là những thói quen duyệt web an toàn? (chọn nhiều đáp án)',
              type: 'MULTIPLE_CHOICE',
              points: 2,
              options: [
                { id: 1020201, content: 'Chỉ tải phần mềm từ trang chính thức' },
                { id: 1020202, content: 'Bấm vào mọi quảng cáo trúng thưởng để nhận quà' },
                { id: 1020203, content: 'Cảnh giác khi trang lạ hỏi mật khẩu ngân hàng' },
                { id: 1020204, content: 'Kiểm tra địa chỉ trang trước khi đăng nhập' },
              ],
              correctOptionIds: [1020201, 1020203, 1020204],
              explanation: 'Quảng cáo trúng thưởng thường là bẫy lừa đảo. Các thói quen còn lại đều giúp bạn an toàn.',
            },
            {
              id: 10203,
              content: 'Thanh địa chỉ của trình duyệt dùng để làm gì?',
              type: 'SINGLE_CHOICE',
              points: 1,
              options: [
                { id: 1020301, content: 'Gõ địa chỉ trang web hoặc từ khóa tìm kiếm' },
                { id: 1020302, content: 'Tăng âm lượng loa' },
                { id: 1020303, content: 'Tắt máy tính' },
              ],
              correctOptionIds: [1020301],
            },
            {
              id: 10204,
              content: 'Cốc Cốc, Chrome, Edge đều là các trình duyệt web.',
              type: 'TRUE_FALSE',
              points: 1,
              options: [
                { id: 1020401, content: 'Đúng' },
                { id: 1020402, content: 'Sai' },
              ],
              correctOptionIds: [1020401],
            },
          ],
        },
      },
      {
        id: 103,
        orderIndex: 3,
        title: 'Email và giao tiếp trực tuyến',
        estimatedMinutes: 25,
        content:
          '<h2>Email là gì?</h2><p>Email (thư điện tử) cho phép bạn gửi và nhận thư qua Internet, kèm cả tệp tin. Một địa chỉ email có dạng <code>tenban@gmail.com</code>.</p><h3>Các phần của một email</h3><ul><li><b>Người nhận (To)</b>: địa chỉ người bạn gửi.</li><li><b>Tiêu đề (Subject)</b>: tóm tắt nội dung.</li><li><b>Nội dung</b>: lời nhắn của bạn.</li><li><b>Tệp đính kèm</b>: ảnh, tài liệu gửi kèm.</li></ul><h2>Giao tiếp lịch sự và an toàn</h2><p>Viết tiêu đề rõ ràng, xưng hô lịch sự. Không mở tệp đính kèm từ người lạ vì có thể chứa mã độc. Không chia sẻ mã OTP cho bất kỳ ai.</p>',
        assignment:
          '<p>Soạn thử một email (chưa cần gửi) gửi cho chính mình với tiêu đề "Chào mừng tôi đến với kỹ năng số" và vài dòng nội dung.</p>',
        attachments: [
          { id: 1, name: 'Huong-dan-tao-email.pdf', url: '#', contentType: 'application/pdf', sizeBytes: 524288 },
        ],
        quiz: {
          id: 1003,
          title: 'Quiz: Email và giao tiếp',
          passScorePercent: PASS,
          timeLimitSeconds: 600,
          questions: [
            {
              id: 10301,
              content: 'Phần nào của email dùng để tóm tắt nội dung thư?',
              type: 'SINGLE_CHOICE',
              points: 1,
              options: [
                { id: 1030101, content: 'Tiêu đề (Subject)' },
                { id: 1030102, content: 'Người nhận (To)' },
                { id: 1030103, content: 'Tệp đính kèm' },
              ],
              correctOptionIds: [1030101],
            },
            {
              id: 10302,
              content: 'Khi nhận email có tệp đính kèm từ một người lạ, bạn nên làm gì?',
              type: 'SINGLE_CHOICE',
              points: 2,
              options: [
                { id: 1030201, content: 'Thận trọng, không mở nếu nghi ngờ' },
                { id: 1030202, content: 'Mở ngay để xem là gì' },
                { id: 1030203, content: 'Chuyển tiếp cho tất cả bạn bè' },
              ],
              correctOptionIds: [1030201],
              explanation: 'Tệp đính kèm từ người lạ có thể chứa mã độc. Hãy thận trọng.',
            },
            {
              id: 10303,
              content: 'Những việc nào KHÔNG nên làm với email/giao tiếp trực tuyến? (chọn nhiều)',
              type: 'MULTIPLE_CHOICE',
              points: 2,
              options: [
                { id: 1030301, content: 'Chia sẻ mã OTP cho người khác' },
                { id: 1030302, content: 'Viết tiêu đề rõ ràng, lịch sự' },
                { id: 1030303, content: 'Mở mọi tệp đính kèm lạ' },
                { id: 1030304, content: 'Nhập mật khẩu vào đường link lạ gửi qua email' },
              ],
              correctOptionIds: [1030301, 1030303, 1030304],
            },
            {
              id: 10304,
              content: 'Một địa chỉ email luôn có ký tự @.',
              type: 'TRUE_FALSE',
              points: 1,
              options: [
                { id: 1030401, content: 'Đúng' },
                { id: 1030402, content: 'Sai' },
              ],
              correctOptionIds: [1030401],
            },
          ],
        },
      },
      {
        id: 104,
        orderIndex: 4,
        title: 'Dịch vụ công trực tuyến',
        estimatedMinutes: 20,
        content:
          '<h2>Dịch vụ công trực tuyến là gì?</h2><p>Là các thủ tục hành chính được thực hiện qua mạng tại Cổng Dịch vụ công Quốc gia (<code>dichvucong.gov.vn</code>) hoặc cổng của tỉnh/thành phố, giúp bạn không phải đi lại nhiều.</p><h3>Các bước chung</h3><ol><li>Đăng ký/đăng nhập tài khoản (có thể dùng tài khoản định danh điện tử VNeID).</li><li>Chọn thủ tục cần làm.</li><li>Điền thông tin, đính kèm giấy tờ.</li><li>Nộp hồ sơ và theo dõi tình trạng xử lý.</li></ol><h2>Lưu ý</h2><p>Chuẩn bị sẵn bản chụp giấy tờ rõ nét. Giữ bí mật mật khẩu và mã OTP. Chỉ thao tác trên cổng chính thức có tên miền <b>.gov.vn</b>.</p>',
        quiz: {
          id: 1004,
          title: 'Quiz: Dịch vụ công trực tuyến',
          passScorePercent: PASS,
          timeLimitSeconds: 600,
          questions: [
            {
              id: 10401,
              content: 'Cổng Dịch vụ công Quốc gia có tên miền nào?',
              type: 'SINGLE_CHOICE',
              points: 1,
              options: [
                { id: 1040101, content: 'dichvucong.gov.vn' },
                { id: 1040102, content: 'dichvucong.com' },
                { id: 1040103, content: 'dichvucong.net' },
              ],
              correctOptionIds: [1040101],
              explanation: 'Cổng chính thức dùng tên miền .gov.vn.',
            },
            {
              id: 10402,
              content: 'Khi làm dịch vụ công trực tuyến, bạn nên làm gì? (chọn nhiều)',
              type: 'MULTIPLE_CHOICE',
              points: 2,
              options: [
                { id: 1040201, content: 'Chuẩn bị bản chụp giấy tờ rõ nét' },
                { id: 1040202, content: 'Giữ bí mật mật khẩu và mã OTP' },
                { id: 1040203, content: 'Chỉ thao tác trên cổng có tên miền .gov.vn' },
                { id: 1040204, content: 'Nhờ người lạ trên mạng nhập hộ mật khẩu' },
              ],
              correctOptionIds: [1040201, 1040202, 1040203],
            },
            {
              id: 10403,
              content: 'Dịch vụ công trực tuyến giúp người dân giảm việc đi lại.',
              type: 'TRUE_FALSE',
              points: 1,
              options: [
                { id: 1040301, content: 'Đúng' },
                { id: 1040302, content: 'Sai' },
              ],
              correctOptionIds: [1040301],
            },
          ],
        },
      },
    ],
  },

  {
    id: 2,
    slug: 'an-toan-thong-tin-ca-nhan',
    title: 'An toàn thông tin cá nhân trên mạng',
    shortDescription: 'Nhận biết lừa đảo trực tuyến, đặt mật khẩu mạnh và bảo vệ tài khoản cá nhân của bạn.',
    description:
      '<p>Mỗi ngày có hàng nghìn vụ lừa đảo trực tuyến nhắm vào người dùng phổ thông. Khóa học ngắn này trang bị cho bạn những nguyên tắc cốt lõi để tự bảo vệ mình trên không gian mạng.</p>',
    outcomes:
      '<ul><li>Nhận biết các hình thức lừa đảo phổ biến.</li><li>Tạo và quản lý mật khẩu mạnh.</li><li>Bật xác thực hai lớp để bảo vệ tài khoản.</li></ul>',
    targetAudience: '<p>Mọi người dùng Internet, đặc biệt người thường xuyên dùng ngân hàng số và mạng xã hội.</p>',
    prerequisites: '<p>Biết sử dụng trình duyệt và email ở mức cơ bản.</p>',
    level: 'BASIC',
    learningDurationDays: 21,
    categoryId: 12,
    enrollmentCount: 876,
    ratingAvg: 4.8,
    ratingCount: 154,
    featured: true,
    ranking: [
      { userId: 9101, name: 'Vũ Quỳnh Anh', totalScore: 11, totalDurationSeconds: 410, completedQuizCount: 3 },
      { userId: 9102, name: 'Bùi Đức Anh', totalScore: 10, totalDurationSeconds: 455, completedQuizCount: 3 },
      { userId: 9103, name: 'Hoàng Thị Mai', totalScore: 8, totalDurationSeconds: 520, completedQuizCount: 2 },
    ],
    reviews: [
      { id: 10, userId: 9101, authorName: 'Vũ Quỳnh Anh', rating: 5, comment: 'Ngắn gọn, đúng trọng tâm. Tôi đã bật xác thực hai lớp ngay sau khi học.', createdAt: '2026-10-12T10:00:00Z' },
      { id: 11, userId: 9102, authorName: 'Bùi Đức Anh', rating: 5, comment: 'Phần nhận biết tin nhắn lừa đảo rất thực tế.', createdAt: '2026-10-09T16:30:00Z' },
    ],
    lessons: [
      {
        id: 201,
        orderIndex: 1,
        title: 'Nhận biết lừa đảo trực tuyến',
        estimatedMinutes: 15,
        content:
          '<h2>Các chiêu trò phổ biến</h2><p>Kẻ gian thường mạo danh ngân hàng, cơ quan nhà nước hoặc người thân để tạo cảm giác cấp bách, khiến bạn vội vàng chuyển tiền hoặc cung cấp thông tin.</p><ul><li>Tin nhắn báo "tài khoản bị khóa", yêu cầu bấm link lạ.</li><li>Cuộc gọi tự xưng công an, viện kiểm sát yêu cầu chuyển tiền.</li><li>Thông báo trúng thưởng, nhận quà cần "đóng phí".</li></ul><div class="alert info"><p>Nguyên tắc vàng: Cơ quan chính thống không bao giờ yêu cầu bạn cung cấp mật khẩu hay mã OTP.</p></div>',
        quiz: {
          id: 2001,
          title: 'Quiz: Nhận biết lừa đảo',
          passScorePercent: PASS,
          timeLimitSeconds: 300,
          questions: [
            {
              id: 20101,
              content: 'Cơ quan chính thống có bao giờ yêu cầu bạn cung cấp mã OTP không?',
              type: 'SINGLE_CHOICE',
              points: 2,
              options: [
                { id: 2010101, content: 'Không bao giờ' },
                { id: 2010102, content: 'Có, khi cần gấp' },
                { id: 2010103, content: 'Có, nếu gọi từ số lạ' },
              ],
              correctOptionIds: [2010101],
              explanation: 'Mã OTP là bí mật cá nhân. Không cơ quan nào yêu cầu bạn cung cấp.',
            },
            {
              id: 20102,
              content: 'Dấu hiệu nào thường gặp ở tin nhắn lừa đảo? (chọn nhiều)',
              type: 'MULTIPLE_CHOICE',
              points: 2,
              options: [
                { id: 2010201, content: 'Tạo cảm giác cấp bách, hù dọa' },
                { id: 2010202, content: 'Kèm đường link lạ' },
                { id: 2010203, content: 'Hứa thưởng lớn cần đóng phí' },
                { id: 2010204, content: 'Gửi từ tổng đài chính thức đã lưu' },
              ],
              correctOptionIds: [2010201, 2010202, 2010203],
            },
          ],
        },
      },
      {
        id: 202,
        orderIndex: 2,
        title: 'Mật khẩu mạnh',
        estimatedMinutes: 12,
        content:
          '<h2>Thế nào là mật khẩu mạnh?</h2><p>Một mật khẩu mạnh nên dài tối thiểu 8-12 ký tự, kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt; không dùng thông tin dễ đoán như ngày sinh.</p><h3>Mẹo ghi nhớ</h3><p>Dùng một câu quen thuộc rồi biến đổi, ví dụ "Toi hoc ky nang so 2026!" → <code>Thkns2026!</code>. Mỗi tài khoản quan trọng nên có mật khẩu khác nhau.</p>',
        quiz: {
          id: 2002,
          title: 'Quiz: Mật khẩu mạnh',
          passScorePercent: PASS,
          timeLimitSeconds: 300,
          questions: [
            {
              id: 20201,
              content: 'Mật khẩu nào mạnh hơn?',
              type: 'SINGLE_CHOICE',
              points: 2,
              options: [
                { id: 2020101, content: 'Th@ngNg0c#2026' },
                { id: 2020102, content: '123456' },
                { id: 2020103, content: 'ngaysinh1990' },
              ],
              correctOptionIds: [2020101],
            },
            {
              id: 20202,
              content: 'Nên dùng chung một mật khẩu cho tất cả tài khoản để dễ nhớ.',
              type: 'TRUE_FALSE',
              points: 1,
              options: [
                { id: 2020201, content: 'Đúng' },
                { id: 2020202, content: 'Sai' },
              ],
              correctOptionIds: [2020202],
              explanation: 'Dùng chung mật khẩu rất nguy hiểm: lộ một nơi là mất tất cả.',
            },
          ],
        },
      },
      {
        id: 203,
        orderIndex: 3,
        title: 'Xác thực hai lớp (2FA)',
        estimatedMinutes: 10,
        content:
          '<h2>Xác thực hai lớp là gì?</h2><p>Ngoài mật khẩu, bạn cần thêm một lớp xác minh thứ hai (mã từ ứng dụng hoặc SMS) khi đăng nhập. Nhờ đó, kể cả khi lộ mật khẩu, kẻ gian vẫn khó chiếm tài khoản.</p><p>Hãy bật 2FA cho email, ngân hàng và mạng xã hội của bạn.</p>',
        quiz: {
          id: 2003,
          title: 'Quiz: Xác thực hai lớp',
          passScorePercent: PASS,
          timeLimitSeconds: 300,
          questions: [
            {
              id: 20301,
              content: 'Xác thực hai lớp giúp ích gì?',
              type: 'SINGLE_CHOICE',
              points: 2,
              options: [
                { id: 2030101, content: 'Bảo vệ tài khoản ngay cả khi lộ mật khẩu' },
                { id: 2030102, content: 'Giúp đăng nhập nhanh hơn' },
                { id: 2030103, content: 'Tăng dung lượng lưu trữ' },
              ],
              correctOptionIds: [2030101],
            },
            {
              id: 20302,
              content: 'Nên bật 2FA cho những tài khoản nào? (chọn nhiều)',
              type: 'MULTIPLE_CHOICE',
              points: 2,
              options: [
                { id: 2030201, content: 'Email' },
                { id: 2030202, content: 'Ngân hàng' },
                { id: 2030203, content: 'Mạng xã hội' },
              ],
              correctOptionIds: [2030201, 2030202, 2030203],
            },
          ],
        },
      },
    ],
  },

  {
    id: 3,
    slug: 'tieng-anh-giao-tiep-nhap-mon',
    title: 'Tiếng Anh giao tiếp nhập môn',
    shortDescription: 'Làm quen các mẫu câu chào hỏi, giới thiệu bản thân và giao tiếp cơ bản hằng ngày.',
    description:
      '<p>Khóa học giúp người mất gốc tự tin nói những câu tiếng Anh đầu tiên. Mỗi bài có ví dụ phát âm, mẫu câu và quiz ôn tập.</p>',
    outcomes: '<ul><li>Chào hỏi và giới thiệu bản thân.</li><li>Hỏi và trả lời các thông tin cơ bản.</li><li>Dùng các mẫu câu lịch sự thông dụng.</li></ul>',
    targetAudience: '<p>Người mới bắt đầu học tiếng Anh, muốn giao tiếp trong tình huống hằng ngày.</p>',
    prerequisites: '<p>Không yêu cầu kiến thức trước.</p>',
    level: 'BASIC',
    learningDurationDays: 21,
    categoryId: 21,
    enrollmentCount: 642,
    ratingAvg: 4.6,
    ratingCount: 98,
    ranking: [
      { userId: 9201, name: 'Ngô Bảo Khánh', totalScore: 9, totalDurationSeconds: 380, completedQuizCount: 3 },
      { userId: 9202, name: 'Dương Thùy Linh', totalScore: 7, totalDurationSeconds: 420, completedQuizCount: 2 },
    ],
    reviews: [
      { id: 20, userId: 9201, authorName: 'Ngô Bảo Khánh', rating: 5, comment: 'Mẫu câu dễ áp dụng, tôi đã dám chào khách nước ngoài.', createdAt: '2026-10-11T07:40:00Z' },
    ],
    lessons: [
      {
        id: 301,
        orderIndex: 1,
        title: 'Greetings — Chào hỏi',
        estimatedMinutes: 12,
        content:
          '<h2>Các câu chào thông dụng</h2><ul><li><b>Hello / Hi</b> — Xin chào.</li><li><b>Good morning</b> — Chào buổi sáng.</li><li><b>How are you?</b> — Bạn khỏe không?</li><li><b>I\'m fine, thank you.</b> — Tôi khỏe, cảm ơn.</li></ul><p>Hãy luyện đọc to mỗi câu 3 lần.</p>',
        quiz: {
          id: 3001,
          title: 'Quiz: Greetings',
          passScorePercent: PASS,
          timeLimitSeconds: 300,
          questions: [
            {
              id: 30101,
              content: '"Good morning" nghĩa là gì?',
              type: 'SINGLE_CHOICE',
              points: 1,
              options: [
                { id: 3010101, content: 'Chào buổi sáng' },
                { id: 3010102, content: 'Tạm biệt' },
                { id: 3010103, content: 'Cảm ơn' },
              ],
              correctOptionIds: [3010101],
            },
            {
              id: 30102,
              content: 'Câu trả lời lịch sự cho "How are you?" là gì?',
              type: 'SINGLE_CHOICE',
              points: 2,
              options: [
                { id: 3010201, content: "I'm fine, thank you." },
                { id: 3010202, content: 'Good morning.' },
                { id: 3010203, content: 'Goodbye.' },
              ],
              correctOptionIds: [3010201],
            },
          ],
        },
      },
      {
        id: 302,
        orderIndex: 2,
        title: 'Introducing yourself — Giới thiệu bản thân',
        estimatedMinutes: 15,
        content:
          '<h2>Mẫu câu giới thiệu</h2><ul><li><b>My name is Lan.</b> — Tên tôi là Lan.</li><li><b>I am from Vietnam.</b> — Tôi đến từ Việt Nam.</li><li><b>Nice to meet you.</b> — Rất vui được gặp bạn.</li></ul>',
        quiz: {
          id: 3002,
          title: 'Quiz: Introducing yourself',
          passScorePercent: PASS,
          timeLimitSeconds: 300,
          questions: [
            {
              id: 30201,
              content: '"I am from Vietnam." nghĩa là gì?',
              type: 'SINGLE_CHOICE',
              points: 1,
              options: [
                { id: 3020101, content: 'Tôi đến từ Việt Nam' },
                { id: 3020102, content: 'Tôi tên là Việt' },
                { id: 3020103, content: 'Tôi thích Việt Nam' },
              ],
              correctOptionIds: [3020101],
            },
            {
              id: 30202,
              content: 'Chọn các mẫu câu dùng để giới thiệu bản thân. (chọn nhiều)',
              type: 'MULTIPLE_CHOICE',
              points: 2,
              options: [
                { id: 3020201, content: 'My name is...' },
                { id: 3020202, content: 'I am from...' },
                { id: 3020203, content: 'How much is it?' },
              ],
              correctOptionIds: [3020201, 3020202],
            },
          ],
        },
      },
      {
        id: 303,
        orderIndex: 3,
        title: 'Polite expressions — Câu lịch sự',
        estimatedMinutes: 10,
        content:
          '<h2>Lịch sự hằng ngày</h2><ul><li><b>Thank you.</b> — Cảm ơn.</li><li><b>You\'re welcome.</b> — Không có gì.</li><li><b>Excuse me.</b> — Xin lỗi (gây chú ý).</li><li><b>Sorry.</b> — Xin lỗi.</li></ul>',
        quiz: {
          id: 3003,
          title: 'Quiz: Polite expressions',
          passScorePercent: PASS,
          timeLimitSeconds: 300,
          questions: [
            {
              id: 30301,
              content: '"You\'re welcome." thường dùng khi nào?',
              type: 'SINGLE_CHOICE',
              points: 2,
              options: [
                { id: 3030101, content: 'Đáp lại lời cảm ơn' },
                { id: 3030102, content: 'Khi chào tạm biệt' },
                { id: 3030103, content: 'Khi hỏi giờ' },
              ],
              correctOptionIds: [3030101],
            },
            {
              id: 30302,
              content: '"Excuse me" và "Sorry" đều là cách nói xin lỗi/lịch sự.',
              type: 'TRUE_FALSE',
              points: 1,
              options: [
                { id: 3030201, content: 'Đúng' },
                { id: 3030202, content: 'Sai' },
              ],
              correctOptionIds: [3030201],
            },
          ],
        },
      },
    ],
  },
];

export function courseBySlug(slug: string) {
  return COURSES.find((c) => c.slug === slug);
}
export function courseById(id: number) {
  return COURSES.find((c) => c.id === id);
}
export function lessonById(id: number): { course: DCourse; lesson: DLesson } | undefined {
  for (const c of COURSES) {
    const l = c.lessons.find((x) => x.id === id);
    if (l) return { course: c, lesson: l };
  }
  return undefined;
}
export function quizById(id: number): { course: DCourse; lesson: DLesson; quiz: DQuiz } | undefined {
  for (const c of COURSES) {
    for (const l of c.lessons) if (l.quiz && l.quiz.id === id) return { course: c, lesson: l, quiz: l.quiz };
  }
  return undefined;
}

export function courseEstimatedMinutes(c: DCourse) {
  return c.lessons.reduce((s, l) => s + (l.estimatedMinutes ?? 0), 0);
}
