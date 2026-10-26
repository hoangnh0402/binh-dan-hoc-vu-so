import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { PublicLayout } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import HomePage from '@/pages/public/HomePage';
import CourseListPage from '@/pages/public/CourseListPage';
import CourseDetailPage from '@/pages/public/CourseDetailPage';
import { GuidePage, NotFoundPage, PrivacyPage, TermsPage } from '@/pages/public/StaticPages';
import { ForgotPasswordPage, LoginPage, RegisterPage, SetPasswordPage, VerifyOtpPage } from '@/pages/auth/AuthPages';
import { LeaderboardPage, MyCoursesPage, ProfilePage } from '@/pages/learner/MyPages';
import { CourseCompletedPage, LearnRedirect, LessonPage, QuizAttemptPage, QuizResultPage } from '@/pages/learner/LearnPages';

// Trang quản trị (kèm trình soạn thảo TipTap) tải riêng, không làm nặng trang người học (NFR-PERF-04).
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminUserCreate = lazy(() => import('@/pages/admin/AdminUsers').then((m) => ({ default: m.AdminUserCreate })));
const AdminCategories = lazy(() => import('@/pages/admin/AdminTaxonomy').then((m) => ({ default: m.AdminCategories })));
const AdminOrganizations = lazy(() => import('@/pages/admin/AdminTaxonomy').then((m) => ({ default: m.AdminOrganizations })));
const AdminCourses = lazy(() => import('@/pages/admin/AdminCourses').then((m) => ({ default: m.AdminCourses })));
const AdminCourseEdit = lazy(() => import('@/pages/admin/AdminCourses').then((m) => ({ default: m.AdminCourseEdit })));
const AdminLessonEdit = lazy(() => import('@/pages/admin/AdminLessonEdit'));
const AdminReviews = lazy(() => import('@/pages/admin/AdminInsight').then((m) => ({ default: m.AdminReviews })));
const AdminAuditLogs = lazy(() => import('@/pages/admin/AdminInsight').then((m) => ({ default: m.AdminAuditLogs })));

/** Chặn trang cần đăng nhập; quay lại trang cũ sau khi đăng nhập (FR-CRS-05). */
function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, ready, isAdmin } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/dang-nhap" replace state={{ from: loc.pathname + loc.search }} />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready, isAdmin } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner />;
  // Vừa đăng nhập xong thì component này render trước lệnh nav() của LoginPage → phải chọn cùng đích.
  const from = (loc.state as { from?: string } | null)?.from;
  return user ? <Navigate to={from ?? (isAdmin ? '/admin' : '/')} replace /> : <>{children}</>;
}

export default function App() {
  const { ready } = useAuth();
  if (!ready) return <Spinner label="Đang tải..." />;
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/khoa-hoc" element={<CourseListPage />} />
        <Route path="/khoa-hoc/:slug" element={<CourseDetailPage />} />
        <Route path="/bang-xep-hang" element={<LeaderboardPage />} />
        <Route path="/huong-dan" element={<GuidePage />} />
        <Route path="/chinh-sach-du-lieu" element={<PrivacyPage />} />
        <Route path="/dieu-khoan" element={<TermsPage />} />
        <Route path="/toi/khoa-hoc" element={<RequireAuth><MyCoursesPage /></RequireAuth>} />
        <Route path="/toi/ho-so" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/hoc/:slug/hoan-thanh" element={<RequireAuth><CourseCompletedPage /></RequireAuth>} />
        <Route path="/xac-thuc-otp" element={<GuestOnly><VerifyOtpPage /></GuestOnly>} />
        <Route path="/quen-mat-khau" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
        <Route path="/dat-mat-khau" element={<SetPasswordPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/dang-nhap" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/dang-ky" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/hoc/:slug" element={<RequireAuth><LearnRedirect /></RequireAuth>} />
      <Route path="/hoc/:slug/bai/:lessonId" element={<RequireAuth><LessonPage /></RequireAuth>} />
      <Route path="/hoc/:slug/quiz/:attemptId" element={<RequireAuth><QuizAttemptPage /></RequireAuth>} />
      <Route path="/hoc/:slug/quiz/:attemptId/ket-qua" element={<RequireAuth><QuizResultPage /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth admin><AdminLayout /></RequireAuth>}>
        <Route index element={<AdminDashboard />} />
        <Route path="nguoi-dung" element={<AdminUsers />} />
        <Route path="nguoi-dung/moi" element={<AdminUserCreate />} />
        <Route path="loai-khoa-hoc" element={<AdminCategories />} />
        <Route path="to-chuc" element={<AdminOrganizations />} />
        <Route path="khoa-hoc" element={<AdminCourses />} />
        <Route path="khoa-hoc/:id" element={<AdminCourseEdit />} />
        <Route path="bai-hoc/:id" element={<AdminLessonEdit />} />
        <Route path="danh-gia" element={<AdminReviews />} />
        <Route path="nhat-ky" element={<AdminAuditLogs />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
