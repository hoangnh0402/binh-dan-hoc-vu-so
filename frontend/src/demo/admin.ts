// Máy chủ giả lập khu vực QUẢN TRỊ cho chế độ DEMO (chạy trên trình duyệt, không backend).
// Seed từ dữ liệu khóa học hiện có + người dùng/đánh giá/nhật ký mẫu; CRUD lưu localStorage.
//
// Lưu ý: admin dùng kho dữ liệu riêng với luồng người học, nên chỉnh sửa ở admin
// không làm thay đổi 3 khóa học dùng để demo học tập. Mục tiêu là trình diễn đủ
// các luồng quản trị trên FE.

import { ApiError } from '@/api/client';
import { CATEGORIES, COURSES, ORG, type DCourse } from './data';

// -------------------------------------------------------------------- kiểu dữ liệu

interface AOption { id: number; content: string; isCorrect: boolean }
interface AQuestion {
  id: number;
  content: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  points: number;
  explanation?: string;
  orderIndex: number;
  answerCount: number;
  options: AOption[];
}
interface AQuiz {
  id: number;
  title: string;
  passScorePercent: number;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  retryCooldownMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswersAfterSubmit: boolean;
  attemptCount: number;
  questions: AQuestion[];
}
interface AAttachment { fileId: number; displayName: string; url: string; contentType: string; sizeBytes: number }
interface ALesson {
  id: number;
  courseId: number;
  orderIndex: number;
  title: string;
  content?: string;
  videoUrl?: string;
  assignment?: string;
  estimatedMinutes?: number;
  isPublished: boolean;
  attachments: AAttachment[];
  quiz?: AQuiz;
  openedCount: number;
  completedCount: number;
}
interface ACourse {
  id: number;
  slug: string;
  title: string;
  categoryId: number;
  organizationId: number;
  level: string;
  shortDescription: string;
  description?: string;
  outcomes?: string;
  targetAudience?: string;
  prerequisites?: string;
  thumbnailUrl?: string;
  startDate?: string;
  endDate?: string;
  learningDurationDays: number;
  estimatedMinutes?: number;
  isFeatured: boolean;
  certificateCriteria?: string;
  publishStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  timeStatus: 'UPCOMING' | 'OPEN' | 'ENDED';
  enrollmentCount: number;
  activeLearners: number;
  updatedAt: string;
  lessons: ALesson[];
}
interface ACategory {
  id: number;
  parentId?: number;
  depth: number;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  sortOrder: number;
  isActive: boolean;
}
interface AOrg {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  website?: string;
  contactEmail?: string;
  description?: string;
  isActive: boolean;
}
interface AEnrollment {
  courseId: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  roundNo: number;
  progressPercent: number;
  enrolledAt: string;
  expiresAt: string;
  completedAt?: string;
  totalScore?: number;
  totalDurationSeconds?: number;
}
interface AUser {
  id: number;
  fullName: string;
  email: string;
  birthYear?: number;
  hometown?: string;
  workplace?: string;
  phone?: string;
  avatarUrl?: string;
  status: 'ACTIVE' | 'LOCKED' | 'PENDING_VERIFICATION';
  lockReason?: string;
  roles: string[];
  createdAt: string;
  lastLoginAt?: string;
  emailVerifiedAt?: string;
  enrollments: AEnrollment[];
}
interface AReview {
  id: number;
  courseId: number;
  userId: number;
  authorName: string;
  rating: number;
  comment?: string;
  isHidden: boolean;
  hiddenReason?: string;
  hiddenByName?: string;
  hiddenAt?: string;
  createdAt: string;
}
interface AAudit {
  id: number;
  createdAt: string;
  actorId?: number;
  actorName: string;
  actionType: string;
  entityType: string;
  entityId?: number;
  beforeData?: string;
  afterData?: string;
  ipAddress?: string;
}
interface AFile { id: number; url: string; originalName: string; contentType: string; sizeBytes: number }

interface AdminState {
  seq: number;
  courses: ACourse[];
  categories: ACategory[];
  orgs: AOrg[];
  users: AUser[];
  reviews: AReview[];
  audit: AAudit[];
  files: Record<number, AFile>;
}

// -------------------------------------------------------------------- persistence

const KEY = 'bdhvs.demo.admin';
// LƯU Ý: không khởi tạo S ở đây. load()/seed() dùng các const (daysAgo, daysAhead...)
// khai báo bên dưới; nếu gọi load() tại điểm này sẽ dính lỗi TDZ lúc nạp module.
// S được khởi tạo ở cuối file, sau khi mọi helper đã sẵn sàng.
let S: AdminState;

function load(): AdminState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AdminState;
  } catch {
    /* bỏ qua */
  }
  const s = seed();
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* bỏ qua */
  }
  return s;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    /* bỏ qua */
  }
}
const nid = () => ++S.seq;
const nowIso = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const err = (status: number, code: string, message: string): never => {
  throw new ApiError({ status, code, message });
};

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// -------------------------------------------------------------------- seed

function seed(): AdminState {
  let seq = 50000;
  const next = () => ++seq;

  // Categories (phẳng): cấp 1 + cấp 2
  const categories: ACategory[] = [];
  CATEGORIES.forEach((p, pi) => {
    categories.push({ id: p.id, depth: 1, name: p.name, slug: p.slug, sortOrder: pi + 1, isActive: true });
    p.children.forEach((ch, ci) => {
      categories.push({ id: ch.id, parentId: p.id, depth: 2, name: ch.name, slug: ch.slug, sortOrder: ci + 1, isActive: true });
    });
  });

  const orgs: AOrg[] = [
    { id: ORG.id, name: ORG.name, slug: ORG.slug, description: ORG.description, contactEmail: 'dhsphn2@hpu2.edu.vn', website: 'https://hpu2.edu.vn', isActive: true },
    { id: next(), name: 'Sở Giáo dục và Đào tạo Hà Nội', slug: 'so-gddt-ha-noi', contactEmail: 'vanphong@hanoi.edu.vn', isActive: true },
  ];

  const courses: ACourse[] = COURSES.map((c) => seedCourse(c));

  // Người dùng mẫu
  const users: AUser[] = [
    {
      id: next(), fullName: 'Quản trị viên Hệ thống', email: 'quantri@hpu2.edu.vn', roles: ['ADMIN', 'USER'],
      status: 'ACTIVE', createdAt: daysAgo(400), lastLoginAt: daysAgo(0), emailVerifiedAt: daysAgo(400), workplace: 'Trường ĐHSP Hà Nội 2', enrollments: [],
    },
    mkUser(9001, 'Nguyễn Thị Lan', 'lan.nguyen@gmail.com', 'ACTIVE', 120, [enr(1, 'COMPLETED', 100, 15, 742)]),
    mkUser(9002, 'Trần Văn Minh', 'minh.tran@gmail.com', 'ACTIVE', 80, [enr(1, 'IN_PROGRESS', 50)]),
    mkUser(9003, 'Phạm Thu Hà', 'ha.pham@gmail.com', 'ACTIVE', 60, [enr(1, 'COMPLETED', 100, 13, 905), enr(2, 'IN_PROGRESS', 66)]),
    mkUser(9004, 'Lê Hoàng Nam', 'nam.le@gmail.com', 'ACTIVE', 40, [enr(1, 'IN_PROGRESS', 25)]),
    mkUser(9005, 'Đỗ Minh Châu', 'chau.do@gmail.com', 'LOCKED', 30, [enr(1, 'IN_PROGRESS', 25)], 'Vi phạm quy định chia sẻ tài khoản'),
    mkUser(9101, 'Vũ Quỳnh Anh', 'quynhanh.vu@gmail.com', 'ACTIVE', 50, [enr(2, 'COMPLETED', 100, 11, 410)]),
    mkUser(9102, 'Bùi Đức Anh', 'ducanh.bui@gmail.com', 'ACTIVE', 20, [enr(2, 'IN_PROGRESS', 33)]),
    mkUser(9201, 'Ngô Bảo Khánh', 'khanh.ngo@gmail.com', 'ACTIVE', 10, [enr(3, 'COMPLETED', 100, 9, 380)]),
    { id: 9300, fullName: 'Người Dùng Mới', email: 'newuser@gmail.com', roles: ['USER'], status: 'PENDING_VERIFICATION', createdAt: daysAgo(1), enrollments: [] },
  ];

  // Đánh giá (từ data) + 1 đánh giá bị ẩn mẫu
  const reviews: AReview[] = [];
  let rid = 1;
  COURSES.forEach((c) => {
    c.reviews.forEach((r) => reviews.push({ id: rid++, courseId: c.id, userId: r.userId, authorName: r.authorName, rating: r.rating, comment: r.comment, isHidden: false, createdAt: r.createdAt }));
  });
  reviews.push({ id: rid++, courseId: 1, userId: 9004, authorName: 'Lê Hoàng Nam', rating: 1, comment: 'Liên hệ 090xxxx để mua tài liệu giá rẻ...', isHidden: true, hiddenReason: 'Spam / quảng cáo', hiddenByName: 'Quản trị viên Hệ thống', hiddenAt: daysAgo(3), createdAt: daysAgo(4) });

  const audit: AAudit[] = [
    aud(1, 'PUBLISH', 'COURSE', 1, daysAgo(20)),
    aud(2, 'CREATE', 'COURSE', 2, daysAgo(18)),
    aud(3, 'UPDATE', 'LESSON', 102, daysAgo(10)),
    aud(4, 'HIDE', 'COURSE_REVIEW', reviews[reviews.length - 1].id, daysAgo(3)),
    aud(5, 'LOCK', 'USER', 9005, daysAgo(2)),
    aud(6, 'CREATE', 'USER', 9300, daysAgo(1)),
  ];

  return { seq, courses, categories, orgs, users, reviews, audit, files: {} };

  function mkUser(id: number, fullName: string, email: string, status: AUser['status'], createdDaysAgo: number, enrollments: AEnrollment[], lockReason?: string): AUser {
    return {
      id, fullName, email, roles: ['USER'], status, lockReason,
      createdAt: daysAgo(createdDaysAgo), lastLoginAt: daysAgo(Math.max(0, Math.floor(createdDaysAgo / 10))), emailVerifiedAt: daysAgo(createdDaysAgo),
      birthYear: 1985 + (id % 20), hometown: 'Hà Nội', phone: '09' + String(10000000 + (id % 90000000)),
      enrollments,
    };
  }
  function enr(courseId: number, status: AEnrollment['status'], progressPercent: number, totalScore?: number, totalDurationSeconds?: number): AEnrollment {
    return {
      courseId, status, roundNo: 1, progressPercent,
      enrolledAt: daysAgo(14), expiresAt: daysAhead(7),
      completedAt: status === 'COMPLETED' ? daysAgo(2) : undefined,
      totalScore, totalDurationSeconds,
    };
  }
  function aud(id: number, actionType: string, entityType: string, entityId: number, createdAt: string): AAudit {
    return { id, actionType, entityType, entityId, createdAt, actorName: 'Quản trị viên Hệ thống', actorId: 1, ipAddress: '113.161.0.' + (id + 10) };
  }
}

function seedCourse(c: DCourse): ACourse {
  const estimated = c.lessons.reduce((s, l) => s + (l.estimatedMinutes ?? 0), 0);
  const lessons: ALesson[] = c.lessons.map((l) => {
    const opened = Math.max(1, Math.round(c.enrollmentCount * Math.max(0.1, 1 - 0.14 * (l.orderIndex - 1))));
    const completed = Math.round(opened * 0.78);
    let quiz: AQuiz | undefined;
    if (l.quiz) {
      quiz = {
        id: l.quiz.id,
        title: l.quiz.title,
        passScorePercent: l.quiz.passScorePercent,
        timeLimitMinutes: l.quiz.timeLimitSeconds ? Math.round(l.quiz.timeLimitSeconds / 60) : undefined,
        maxAttempts: l.quiz.maxAttempts,
        retryCooldownMinutes: 0,
        shuffleQuestions: false,
        shuffleOptions: false,
        showAnswersAfterSubmit: true,
        attemptCount: opened,
        questions: l.quiz.questions.map((q, qi) => ({
          id: q.id,
          content: q.content,
          type: q.type,
          points: q.points,
          explanation: q.explanation,
          orderIndex: qi + 1,
          answerCount: completed,
          options: q.options.map((o) => ({ id: o.id, content: o.content, isCorrect: q.correctOptionIds.includes(o.id) })),
        })),
      };
    }
    return {
      id: l.id, courseId: c.id, orderIndex: l.orderIndex, title: l.title,
      content: l.content, videoUrl: l.videoUrl, assignment: l.assignment, estimatedMinutes: l.estimatedMinutes,
      isPublished: true, attachments: [], quiz, openedCount: opened, completedCount: completed,
    };
  });
  return {
    id: c.id, slug: c.slug, title: c.title, categoryId: c.categoryId, organizationId: ORG.id, level: c.level,
    shortDescription: c.shortDescription, description: c.description, outcomes: c.outcomes, targetAudience: c.targetAudience, prerequisites: c.prerequisites,
    thumbnailUrl: undefined, startDate: daysAgo(30), endDate: undefined, learningDurationDays: c.learningDurationDays,
    estimatedMinutes: estimated, isFeatured: !!c.featured, certificateCriteria: JSON.stringify({ minProgress: 100, minAvgScorePercent: 70 }),
    publishStatus: 'PUBLISHED', timeStatus: 'OPEN', enrollmentCount: c.enrollmentCount, activeLearners: Math.round(c.enrollmentCount * 0.35),
    updatedAt: daysAgo(5), lessons,
  };
}

// -------------------------------------------------------------------- helpers chung

interface Actor { id?: number; name: string }

function recordAudit(actor: Actor, actionType: string, entityType: string, entityId?: number, before?: unknown, after?: unknown) {
  S.audit.unshift({
    id: nid(),
    createdAt: nowIso(),
    actorId: actor.id,
    actorName: actor.name,
    actionType,
    entityType,
    entityId,
    beforeData: before ? JSON.stringify(before) : undefined,
    afterData: after ? JSON.stringify(after) : undefined,
    ipAddress: '127.0.0.1',
  });
}

function pageOf<T>(items: T[], page: number, size: number) {
  const start = page * size;
  return { items: items.slice(start, start + size), page, size, totalItems: items.length, totalPages: Math.max(1, Math.ceil(items.length / size)) };
}

const catById = (id?: number) => S.categories.find((c) => c.id === id);
const orgById = (id?: number) => S.orgs.find((o) => o.id === id);
const courseCountOfCategory = (id: number) => S.courses.filter((c) => c.categoryId === id || catById(c.categoryId)?.parentId === id).length;
const courseCountOfOrg = (id: number) => S.courses.filter((c) => c.organizationId === id).length;

function catPath(categoryId: number) {
  const child = catById(categoryId);
  const parent = child?.parentId ? catById(child.parentId) : undefined;
  return {
    category: child ?? { id: 0, name: '—', slug: '' },
    parent: parent ?? child ?? { id: 0, name: '—', slug: '' },
  };
}

// -------------------------------------------------------------------- bộ định tuyến admin

type Opts = { method?: string; body?: any; form?: FormData };

export async function handleAdmin(seg: string[], method: string, query: URLSearchParams, opts: Opts, actor: Actor): Promise<any> {
  const r = seg[1]; // phần sau /admin

  if (r === 'dashboard') return dashboard();
  if (r === 'categories') return categoriesRoute(seg, method, opts, actor);
  if (r === 'organizations') return orgsRoute(seg, method, query, opts, actor);
  if (r === 'users') return usersRoute(seg, method, query, opts, actor);
  if (r === 'courses') return coursesRoute(seg, method, query, opts, actor);
  if (r === 'lessons') return lessonsRoute(seg, method, opts, actor);
  if (r === 'quizzes') return quizzesRoute(seg, method, opts, actor);
  if (r === 'questions') return questionsRoute(seg, method, opts, actor);
  if (r === 'reviews') return reviewsRoute(seg, method, query, opts, actor);
  if (r === 'audit-logs') return auditRoute(seg, query);
  if (r === 'files') return filesRoute(opts);

  return err(404, 'DEMO_NOT_IMPLEMENTED', `DEMO (admin) chưa hỗ trợ: ${method} /${seg.join('/')}`);
}

// ---------- dashboard
function dashboard() {
  const totalEnrollments = S.courses.reduce((s, c) => s + c.enrollmentCount, 0);
  const completedEnrollments = S.users.reduce((s, u) => s + u.enrollments.filter((e) => e.status === 'COMPLETED').length, 0) + Math.round(totalEnrollments * 0.18);
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day, newUsers: 2 + ((i * 7) % 9), enrollments: 5 + ((i * 13) % 18) };
  });
  const topCourses = [...S.courses].sort((a, b) => b.enrollmentCount - a.enrollmentCount).slice(0, 5).map((c) => ({ id: c.id, title: c.title, slug: c.slug, enrollmentCount: c.enrollmentCount }));
  return {
    stats: {
      totalUsers: S.users.length,
      newUsers7d: S.users.filter((u) => Date.now() - new Date(u.createdAt).getTime() < 7 * 86_400_000).length + 12,
      publishedCourses: S.courses.filter((c) => c.publishStatus === 'PUBLISHED').length,
      upcomingCourses: S.courses.filter((c) => c.timeStatus === 'UPCOMING').length,
      totalEnrollments,
      newEnrollments30d: 214,
      completedEnrollments,
      expiredEnrollments30d: 37,
      lowRatingReviews7d: S.reviews.filter((r) => r.rating <= 2 && Date.now() - new Date(r.createdAt).getTime() < 7 * 86_400_000).length,
    },
    daily,
    topCourses,
    recentAudit: S.audit.slice(0, 6).map((a) => ({ createdAt: a.createdAt, actorName: a.actorName, actionType: a.actionType, entityType: a.entityType, entityId: a.entityId })),
  };
}

// ---------- categories
function categoryDto(c: ACategory): any {
  return {
    id: c.id, parentId: c.parentId, depth: c.depth, name: c.name, slug: c.slug, description: c.description, iconUrl: c.iconUrl,
    sortOrder: c.sortOrder, isActive: c.isActive, courseCount: courseCountOfCategory(c.id),
    children: c.depth === 1 ? S.categories.filter((x) => x.parentId === c.id).sort((a, b) => a.sortOrder - b.sortOrder).map(categoryDto) : [],
  };
}
function categoriesRoute(seg: string[], method: string, opts: Opts, actor: Actor): any {
  if (seg[2] === 'reorder' && method === 'PUT') {
    (opts.body as { id: number; sortOrder: number }[]).forEach((it) => {
      const c = S.categories.find((x) => x.id === it.id);
      if (c) c.sortOrder = it.sortOrder;
    });
    save();
    return undefined;
  }
  if (seg.length === 2) {
    if (method === 'GET') return S.categories.filter((c) => c.depth === 1).sort((a, b) => a.sortOrder - b.sortOrder).map(categoryDto);
    if (method === 'POST') {
      const b = opts.body;
      const parentId = b.parentId ?? null;
      const depth = parentId ? 2 : 1;
      const siblings = S.categories.filter((x) => (x.parentId ?? null) === parentId);
      const c: ACategory = { id: nid(), parentId: parentId ?? undefined, depth, name: b.name, slug: b.slug || slugify(b.name), description: b.description, sortOrder: siblings.length + 1, isActive: b.isActive ?? true };
      S.categories.push(c);
      recordAudit(actor, 'CREATE', 'COURSE_CATEGORY', c.id, undefined, { name: c.name });
      save();
      return categoryDto(c);
    }
  }
  const id = Number(seg[2]);
  const c = S.categories.find((x) => x.id === id);
  if (!c) err(404, 'NOT_FOUND', 'Không tìm thấy loại khóa học');
  if (method === 'PUT') {
    const before = { name: c!.name, isActive: c!.isActive };
    const b = opts.body;
    c!.name = b.name ?? c!.name;
    c!.slug = b.slug || slugify(b.name ?? c!.name);
    c!.description = b.description;
    if (b.parentId !== undefined) { c!.parentId = b.parentId ?? undefined; c!.depth = b.parentId ? 2 : 1; }
    if (b.isActive !== undefined) c!.isActive = b.isActive;
    recordAudit(actor, 'UPDATE', 'COURSE_CATEGORY', c!.id, before, { name: c!.name, isActive: c!.isActive });
    save();
    return categoryDto(c!);
  }
  if (method === 'DELETE') {
    if (courseCountOfCategory(id) > 0) err(409, 'CATEGORY_HAS_COURSES', 'Loại khóa học đang có khóa học, không thể xóa. Hãy tắt hoạt động thay vì xóa.');
    if (S.categories.some((x) => x.parentId === id)) err(409, 'CATEGORY_HAS_CHILDREN', 'Loại cha đang có loại con, không thể xóa.');
    S.categories = S.categories.filter((x) => x.id !== id);
    recordAudit(actor, 'DELETE', 'COURSE_CATEGORY', id);
    save();
    return undefined;
  }
}

// ---------- organizations
function orgDto(o: AOrg): any {
  return { ...o, courseCount: courseCountOfOrg(o.id) };
}
function orgsRoute(seg: string[], method: string, query: URLSearchParams, opts: Opts, actor: Actor): any {
  if (seg.length === 2) {
    if (method === 'GET') {
      const q = (query.get('q') ?? '').toLowerCase().trim();
      return S.orgs.filter((o) => !q || o.name.toLowerCase().includes(q)).map(orgDto);
    }
    if (method === 'POST') {
      const b = opts.body;
      const o: AOrg = { id: nid(), name: b.name, slug: b.slug || slugify(b.name), logoUrl: b.logoUrl || undefined, website: b.website || undefined, contactEmail: b.contactEmail || undefined, description: b.description || undefined, isActive: b.isActive ?? true };
      S.orgs.push(o);
      recordAudit(actor, 'CREATE', 'ORGANIZATION', o.id, undefined, { name: o.name });
      save();
      return orgDto(o);
    }
  }
  const id = Number(seg[2]);
  const o = S.orgs.find((x) => x.id === id);
  if (!o) err(404, 'NOT_FOUND', 'Không tìm thấy tổ chức');
  if (method === 'PUT') {
    const before = { ...o! };
    Object.assign(o!, opts.body, { slug: opts.body.slug || slugify(opts.body.name ?? o!.name) });
    recordAudit(actor, 'UPDATE', 'ORGANIZATION', id, { name: before.name }, { name: o!.name });
    save();
    return orgDto(o!);
  }
  if (method === 'DELETE') {
    if (courseCountOfOrg(id) > 0) err(409, 'ORG_HAS_COURSES', 'Tổ chức đang có khóa học, không thể xóa.');
    S.orgs = S.orgs.filter((x) => x.id !== id);
    recordAudit(actor, 'DELETE', 'ORGANIZATION', id);
    save();
    return undefined;
  }
}

// ---------- users
function userRow(u: AUser): any {
  return { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, avatarUrl: u.avatarUrl, status: u.status, roles: u.roles.join(','), createdAt: u.createdAt, lastLoginAt: u.lastLoginAt };
}
function userDetail(u: AUser): any {
  return {
    ...u,
    roles: u.roles,
    enrollments: u.enrollments.map((e) => {
      const c = S.courses.find((x) => x.id === e.courseId);
      return { courseId: e.courseId, courseTitle: c?.title ?? 'Khóa học', courseSlug: c?.slug ?? '', status: e.status, roundNo: e.roundNo, progressPercent: e.progressPercent, enrolledAt: e.enrolledAt, expiresAt: e.expiresAt, completedAt: e.completedAt, totalScore: e.totalScore };
    }),
  };
}
function usersRoute(seg: string[], method: string, query: URLSearchParams, opts: Opts, actor: Actor): any {
  if (seg[2] === 'export') {
    const rows = filterUsers(query);
    const header = 'ID,Ho ten,Email,Vai tro,Trang thai,Ngay tao';
    const body = rows.map((u) => [u.id, csv(u.fullName), u.email, u.roles.join('|'), u.status, u.createdAt.slice(0, 10)].join(',')).join('\n');
    recordAudit(actor, 'EXPORT', 'USER');
    return header + '\n' + body;
  }
  if (seg.length === 2) {
    if (method === 'GET') {
      const rows = filterUsers(query).map(userRow);
      const page = Number(query.get('page') ?? 0);
      const size = Number(query.get('size') ?? 20);
      return pageOf(rows, page, size);
    }
    if (method === 'POST') {
      const b = opts.body;
      const u: AUser = {
        id: nid(), fullName: b.fullName, email: b.email, roles: b.roles ?? ['USER'],
        status: b.status ?? 'ACTIVE', birthYear: b.birthYear ?? undefined, hometown: b.hometown || undefined, workplace: b.workplace || undefined, phone: b.phone || undefined,
        createdAt: nowIso(), emailVerifiedAt: nowIso(), enrollments: [],
      };
      S.users.unshift(u);
      recordAudit(actor, 'CREATE', 'USER', u.id, undefined, { fullName: u.fullName, email: u.email });
      save();
      return { id: u.id };
    }
  }
  const id = Number(seg[2]);
  const u = S.users.find((x) => x.id === id);
  if (!u) err(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');
  const sub = seg[3];
  if (!sub && method === 'GET') return userDetail(u!);
  if (!sub && method === 'PUT') {
    const before = { fullName: u!.fullName, email: u!.email, roles: [...u!.roles] };
    const b = opts.body;
    Object.assign(u!, { fullName: b.fullName, email: b.email, birthYear: b.birthYear ?? undefined, hometown: b.hometown, workplace: b.workplace, phone: b.phone, roles: b.roles ?? u!.roles });
    recordAudit(actor, before.roles.join() !== (u!.roles).join() ? 'ROLE_CHANGE' : 'UPDATE', 'USER', id, before, { fullName: u!.fullName, roles: u!.roles });
    save();
    return userDetail(u!);
  }
  if (!sub && method === 'DELETE') {
    u!.status = 'LOCKED';
    u!.email = `deleted+${id}@example.invalid`;
    u!.fullName = 'Người dùng đã xóa';
    recordAudit(actor, 'DELETE', 'USER', id);
    save();
    return undefined;
  }
  if (sub === 'lock' && method === 'POST') {
    u!.status = 'LOCKED';
    u!.lockReason = opts.body?.reason;
    recordAudit(actor, 'LOCK', 'USER', id, undefined, { reason: u!.lockReason });
    save();
    return undefined;
  }
  if (sub === 'unlock' && method === 'POST') {
    u!.status = 'ACTIVE';
    u!.lockReason = undefined;
    recordAudit(actor, 'UNLOCK', 'USER', id);
    save();
    return undefined;
  }
  if (sub === 'send-reset-password' && method === 'POST') {
    recordAudit(actor, 'RESET_PASSWORD', 'USER', id);
    save();
    return undefined;
  }
}
function filterUsers(query: URLSearchParams): AUser[] {
  const q = (query.get('q') ?? '').toLowerCase().trim();
  const role = query.get('role') ?? '';
  const status = query.get('status') ?? '';
  return S.users.filter((u) => {
    if (q && !(u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone ?? '').includes(q))) return false;
    if (role === 'ADMIN' && !u.roles.includes('ADMIN')) return false;
    if (role === 'USER' && u.roles.includes('ADMIN')) return false;
    if (status && u.status !== status) return false;
    return true;
  });
}

// ---------- courses
function courseRow(c: ACourse): any {
  const { category, parent } = catPath(c.categoryId);
  return {
    id: c.id, slug: c.slug, title: c.title, thumbnailUrl: c.thumbnailUrl,
    categoryName: category.name, parentCategoryName: parent.name, organizationName: orgById(c.organizationId)?.name ?? '—',
    level: c.level, publishStatus: c.publishStatus, timeStatus: c.timeStatus,
    publishedLessonCount: c.lessons.filter((l) => l.isPublished).length, lessonCount: c.lessons.length,
    enrollmentCount: c.enrollmentCount, learningDurationDays: c.learningDurationDays, isFeatured: c.isFeatured, updatedAt: c.updatedAt,
  };
}
function courseForm(c: ACourse): any {
  return {
    id: c.id, slug: c.slug, title: c.title, categoryId: c.categoryId, organizationId: c.organizationId, level: c.level,
    shortDescription: c.shortDescription, description: c.description, outcomes: c.outcomes, targetAudience: c.targetAudience, prerequisites: c.prerequisites,
    thumbnailUrl: c.thumbnailUrl, startDate: c.startDate, endDate: c.endDate, learningDurationDays: c.learningDurationDays, estimatedMinutes: c.estimatedMinutes,
    isFeatured: c.isFeatured, certificateCriteria: c.certificateCriteria, publishStatus: c.publishStatus, timeStatus: c.timeStatus,
    enrollmentCount: c.enrollmentCount, activeLearners: c.activeLearners, publishedLessonCount: c.lessons.filter((l) => l.isPublished).length, updatedAt: c.updatedAt,
  };
}
function lessonRow(l: ALesson): any {
  return { id: l.id, orderIndex: l.orderIndex, title: l.title, estimatedMinutes: l.estimatedMinutes, isPublished: l.isPublished, quizId: l.quiz?.id, questionCount: l.quiz?.questions.length ?? 0, openedCount: l.openedCount, completedCount: l.completedCount };
}
function coursesRoute(seg: string[], method: string, query: URLSearchParams, opts: Opts, actor: Actor): any {
  if (seg.length === 2) {
    if (method === 'GET') {
      const q = (query.get('q') ?? '').toLowerCase().trim();
      const categoryId = query.get('categoryId');
      const organizationId = query.get('organizationId');
      const level = query.get('level');
      const publishStatus = query.get('publishStatus');
      const timeStatus = query.get('timeStatus');
      let list = S.courses.filter((c) => {
        if (q && !(c.title.toLowerCase().includes(q) || slugify(c.title).includes(slugify(q)))) return false;
        if (categoryId) { const cid = Number(categoryId); if (c.categoryId !== cid && catById(c.categoryId)?.parentId !== cid) return false; }
        if (organizationId && c.organizationId !== Number(organizationId)) return false;
        if (level && c.level !== level) return false;
        if (publishStatus && c.publishStatus !== publishStatus) return false;
        if (timeStatus && c.timeStatus !== timeStatus) return false;
        return true;
      });
      list = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return pageOf(list.map(courseRow), Number(query.get('page') ?? 0), Number(query.get('size') ?? 20));
    }
    if (method === 'POST') {
      const b = opts.body;
      const c: ACourse = {
        id: nid(), slug: b.slug || slugify(b.title), title: b.title, categoryId: b.categoryId, organizationId: b.organizationId, level: b.level ?? 'BASIC',
        shortDescription: b.shortDescription ?? '', description: b.description, outcomes: b.outcomes, targetAudience: b.targetAudience, prerequisites: b.prerequisites,
        thumbnailUrl: b.thumbnailUrl || undefined, startDate: b.startDate || undefined, endDate: b.endDate || undefined, learningDurationDays: b.learningDurationDays ?? 21, estimatedMinutes: b.estimatedMinutes ?? undefined,
        isFeatured: b.isFeatured ?? false, certificateCriteria: JSON.stringify({ minProgress: 100, minAvgScorePercent: 70 }),
        publishStatus: 'DRAFT', timeStatus: b.startDate && new Date(b.startDate).getTime() > Date.now() ? 'UPCOMING' : 'OPEN',
        enrollmentCount: 0, activeLearners: 0, updatedAt: nowIso(), lessons: [],
      };
      S.courses.unshift(c);
      recordAudit(actor, 'CREATE', 'COURSE', c.id, undefined, { title: c.title });
      save();
      return { id: c.id };
    }
  }
  const id = Number(seg[2]);
  const c = S.courses.find((x) => x.id === id);
  if (!c) err(404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học');

  // sub-routes
  const sub = seg[3];
  if (!sub) {
    if (method === 'GET') return courseForm(c!);
    if (method === 'PUT') {
      const before = { title: c!.title };
      const b = opts.body;
      Object.assign(c!, {
        title: b.title ?? c!.title, slug: b.slug || slugify(b.title ?? c!.title), categoryId: b.categoryId ?? c!.categoryId, organizationId: b.organizationId ?? c!.organizationId,
        level: b.level ?? c!.level, shortDescription: b.shortDescription ?? c!.shortDescription, description: b.description, outcomes: b.outcomes, targetAudience: b.targetAudience, prerequisites: b.prerequisites,
        thumbnailUrl: b.thumbnailUrl ?? c!.thumbnailUrl, startDate: b.startDate ?? c!.startDate, endDate: b.endDate ?? c!.endDate, learningDurationDays: b.learningDurationDays ?? c!.learningDurationDays,
        estimatedMinutes: b.estimatedMinutes ?? c!.estimatedMinutes, isFeatured: b.isFeatured ?? c!.isFeatured, updatedAt: nowIso(),
      });
      recordAudit(actor, 'UPDATE', 'COURSE', id, before, { title: c!.title });
      save();
      return courseForm(c!);
    }
    if (method === 'DELETE') {
      if (c!.enrollmentCount > 0) err(409, 'COURSE_HAS_LEARNERS', 'Khóa học đã có học viên, không thể xóa.');
      S.courses = S.courses.filter((x) => x.id !== id);
      recordAudit(actor, 'DELETE', 'COURSE', id);
      save();
      return undefined;
    }
  }
  if (['publish', 'unpublish', 'archive', 'restore'].includes(sub) && method === 'POST') {
    if (sub === 'publish') {
      if (!c!.thumbnailUrl) err(422, 'MISSING_THUMBNAIL', 'Cần có ảnh bìa trước khi xuất bản.');
      if (c!.lessons.filter((l) => l.isPublished).length === 0) err(422, 'NO_PUBLISHED_LESSON', 'Cần có ít nhất 1 bài học đã xuất bản.');
      c!.publishStatus = 'PUBLISHED';
    } else if (sub === 'unpublish') c!.publishStatus = 'DRAFT';
    else if (sub === 'archive') c!.publishStatus = 'ARCHIVED';
    else if (sub === 'restore') c!.publishStatus = 'PUBLISHED';
    c!.updatedAt = nowIso();
    recordAudit(actor, sub.toUpperCase(), 'COURSE', id);
    save();
    return undefined;
  }
  if (sub === 'lessons') {
    if (seg[4] === 'reorder' && method === 'PUT') {
      (opts.body as { id: number; orderIndex: number }[]).forEach((it) => { const l = c!.lessons.find((x) => x.id === it.id); if (l) l.orderIndex = it.orderIndex; });
      c!.lessons.sort((a, b) => a.orderIndex - b.orderIndex);
      recordAudit(actor, 'UPDATE', 'COURSE', id, undefined, { reordered: true });
      save();
      return c!.lessons.map(lessonRow);
    }
    if (method === 'GET') return [...c!.lessons].sort((a, b) => a.orderIndex - b.orderIndex).map(lessonRow);
    if (method === 'POST') {
      const l: ALesson = { id: nid(), courseId: id, orderIndex: c!.lessons.length + 1, title: opts.body?.title ?? 'Bài học mới', isPublished: false, attachments: [], openedCount: 0, completedCount: 0 };
      c!.lessons.push(l);
      recordAudit(actor, 'CREATE', 'LESSON', l.id, undefined, { title: l.title });
      save();
      return { id: l.id };
    }
  }
  if (sub === 'enrollments') {
    const rows = enrollmentRows(id);
    if (seg[4] === 'export') {
      const header = 'User ID,Ho ten,Email,Trang thai,Lan hoc,Tien do %,Ghi danh,Han hoc,Diem';
      const body = rows.map((e) => [e.userId, csv(e.fullName), e.email, e.status, e.roundNo, e.progressPercent, e.enrolledAt.slice(0, 10), e.expiresAt.slice(0, 10), e.totalScore ?? ''].join(',')).join('\n');
      recordAudit(actor, 'EXPORT', 'COURSE', id);
      return header + '\n' + body;
    }
    const q = (query.get('q') ?? '').toLowerCase().trim();
    const status = query.get('status') ?? '';
    const filtered = rows.filter((e) => (!q || e.fullName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)) && (!status || e.status === status));
    return pageOf(filtered, Number(query.get('page') ?? 0), Number(query.get('size') ?? 20));
  }
  if (sub === 'ranking') {
    if (seg[4] === 'recalculate' && method === 'POST') {
      recordAudit(actor, 'RECALCULATE_RANKING', 'COURSE', id);
      save();
      return { message: 'Đang tính lại xếp hạng ở chế độ nền. Kết quả sẽ cập nhật sau ít phút.' };
    }
    const src = COURSES.find((x) => x.id === id);
    const rows = (src?.ranking ?? []).map((r, i) => ({ rank: i + 1, userId: r.userId, displayName: r.name, totalScore: r.totalScore, totalDurationSeconds: r.totalDurationSeconds, completedQuizCount: r.completedQuizCount, me: false }));
    return pageOf(rows, 0, Number(query.get('size') ?? 50));
  }
}
function enrollmentRows(courseId: number): any[] {
  return S.users
    .filter((u) => u.enrollments.some((e) => e.courseId === courseId))
    .map((u) => {
      const e = u.enrollments.find((x) => x.courseId === courseId)!;
      return { userId: u.id, fullName: u.fullName, email: u.email, status: e.status, roundNo: e.roundNo, progressPercent: e.progressPercent, enrolledAt: e.enrolledAt, expiresAt: e.expiresAt, completedAt: e.completedAt, totalScore: e.totalScore, totalDurationSeconds: e.totalDurationSeconds };
    });
}

// ---------- lessons
function findLesson(id: number): { course: ACourse; lesson: ALesson } | undefined {
  for (const c of S.courses) { const l = c.lessons.find((x) => x.id === id); if (l) return { course: c, lesson: l }; }
  return undefined;
}
function lessonForm(l: ALesson): any {
  return {
    id: l.id, courseId: l.courseId, orderIndex: l.orderIndex, title: l.title, content: l.content, videoUrl: l.videoUrl, assignment: l.assignment,
    estimatedMinutes: l.estimatedMinutes, isPublished: l.isPublished, attachments: l.attachments, openedCount: l.openedCount, completedCount: l.completedCount,
    quiz: l.quiz ? { ...l.quiz, questions: l.quiz.questions.map((q) => ({ ...q })) } : undefined,
  };
}
function lessonsRoute(seg: string[], method: string, opts: Opts, actor: Actor): any {
  const id = Number(seg[2]);
  const found = findLesson(id);
  if (!found) err(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  const { course, lesson } = found!;

  if (seg[3] === 'quiz') {
    if (method === 'PUT') {
      const b = opts.body;
      if (!lesson.quiz) {
        lesson.quiz = { id: nid(), title: b.title || `Quiz: ${lesson.title}`, passScorePercent: b.passScorePercent ?? 70, timeLimitMinutes: b.timeLimitMinutes ?? undefined, maxAttempts: b.maxAttempts ?? undefined, retryCooldownMinutes: b.retryCooldownMinutes ?? 0, shuffleQuestions: !!b.shuffleQuestions, shuffleOptions: !!b.shuffleOptions, showAnswersAfterSubmit: b.showAnswersAfterSubmit ?? true, attemptCount: 0, questions: [] };
        recordAudit(actor, 'CREATE', 'QUIZ', lesson.quiz.id, undefined, { lessonId: id });
      } else {
        Object.assign(lesson.quiz, { title: b.title || lesson.quiz.title, passScorePercent: b.passScorePercent ?? lesson.quiz.passScorePercent, timeLimitMinutes: b.timeLimitMinutes ?? undefined, maxAttempts: b.maxAttempts ?? undefined, retryCooldownMinutes: b.retryCooldownMinutes ?? 0, shuffleQuestions: !!b.shuffleQuestions, shuffleOptions: !!b.shuffleOptions, showAnswersAfterSubmit: b.showAnswersAfterSubmit ?? true });
        recordAudit(actor, 'UPDATE', 'QUIZ', lesson.quiz.id);
      }
      save();
      return undefined;
    }
    if (method === 'DELETE') {
      if (lesson.quiz && lesson.quiz.attemptCount > 0) err(409, 'QUIZ_HAS_ATTEMPTS', 'Quiz đã có người làm, không thể tắt.');
      const qid = lesson.quiz?.id;
      lesson.quiz = undefined;
      recordAudit(actor, 'DELETE', 'QUIZ', qid);
      save();
      return undefined;
    }
  }

  if (!seg[3]) {
    if (method === 'GET') return lessonForm(lesson);
    if (method === 'PUT') {
      const before = { title: lesson.title, isPublished: lesson.isPublished };
      const b = opts.body;
      lesson.title = b.title ?? lesson.title;
      lesson.content = b.content;
      lesson.videoUrl = b.videoUrl || undefined;
      lesson.assignment = b.assignment;
      lesson.estimatedMinutes = b.estimatedMinutes ?? undefined;
      lesson.isPublished = b.isPublished ?? lesson.isPublished;
      lesson.attachments = (b.attachments ?? []).map((a: { fileId: number; displayName: string }) => {
        const existing = lesson.attachments.find((x) => x.fileId === a.fileId) ?? S.files[a.fileId];
        return existing ? { fileId: a.fileId, displayName: a.displayName, url: existing.url, contentType: existing.contentType, sizeBytes: existing.sizeBytes } : { fileId: a.fileId, displayName: a.displayName, url: '#', contentType: 'application/octet-stream', sizeBytes: 0 };
      });
      course.updatedAt = nowIso();
      recordAudit(actor, 'UPDATE', 'LESSON', id, before, { title: lesson.title, isPublished: lesson.isPublished });
      save();
      return lessonForm(lesson);
    }
    if (method === 'DELETE') {
      if (lesson.openedCount > 0) err(409, 'LESSON_HAS_LEARNERS', 'Bài học đã có người học, chỉ có thể ẩn (bỏ xuất bản).');
      course.lessons = course.lessons.filter((x) => x.id !== id);
      course.lessons.forEach((x, i) => (x.orderIndex = i + 1));
      recordAudit(actor, 'DELETE', 'LESSON', id);
      save();
      return undefined;
    }
  }
}

// ---------- quizzes (questions)
function findQuiz(quizId: number): { lesson: ALesson; quiz: AQuiz } | undefined {
  for (const c of S.courses) for (const l of c.lessons) if (l.quiz?.id === quizId) return { lesson: l, quiz: l.quiz };
  return undefined;
}
function quizzesRoute(seg: string[], method: string, opts: Opts, actor: Actor): any {
  const quizId = Number(seg[2]);
  const found = findQuiz(quizId);
  if (!found) err(404, 'QUIZ_NOT_FOUND', 'Không tìm thấy quiz');
  const { quiz } = found!;
  if (seg[3] === 'questions' && seg[4] === 'import' && method === 'POST') {
    // Nhập CSV: loai;noi_dung;diem;giai_thich;dap_an_1;...  (đáp án đúng có tiền tố *)
    const errors: string[] = [];
    let created = 0;
    // Ở demo không đọc tệp thật — tạo 2 câu hỏi mẫu để minh họa luồng.
    for (let i = 0; i < 2; i++) {
      quiz.questions.push({
        id: nid(), content: `Câu hỏi nhập từ CSV #${quiz.questions.length + 1}`, type: 'SINGLE_CHOICE', points: 1, orderIndex: quiz.questions.length + 1, answerCount: 0,
        options: [ { id: nid(), content: 'Đáp án đúng', isCorrect: true }, { id: nid(), content: 'Đáp án sai', isCorrect: false } ],
      });
      created++;
    }
    recordAudit(actor, 'IMPORT', 'QUIZ', quizId, undefined, { created });
    save();
    return { created, errors };
  }
  if (seg[3] === 'questions' && method === 'POST') {
    const b = opts.body;
    const q: AQuestion = {
      id: nid(), content: b.content, type: b.type, points: Number(b.points) || 1, explanation: b.explanation, orderIndex: quiz.questions.length + 1, answerCount: 0,
      options: (b.options as { content: string; isCorrect: boolean }[]).map((o) => ({ id: nid(), content: o.content, isCorrect: o.isCorrect })),
    };
    quiz.questions.push(q);
    recordAudit(actor, 'CREATE', 'QUESTION', q.id, undefined, { quizId });
    save();
    return q;
  }
}

// ---------- questions
function findQuestion(id: number): { quiz: AQuiz; q: AQuestion } | undefined {
  for (const c of S.courses) for (const l of c.lessons) if (l.quiz) { const q = l.quiz.questions.find((x) => x.id === id); if (q) return { quiz: l.quiz, q }; }
  return undefined;
}
function questionsRoute(seg: string[], method: string, opts: Opts, actor: Actor): any {
  const id = Number(seg[2]);
  const found = findQuestion(id);
  if (!found) err(404, 'QUESTION_NOT_FOUND', 'Không tìm thấy câu hỏi');
  const { quiz, q } = found!;
  if (method === 'PUT') {
    const b = opts.body;
    q.content = b.content;
    q.type = b.type;
    q.points = Number(b.points) || 1;
    q.explanation = b.explanation;
    q.options = (b.options as { id?: number; content: string; isCorrect: boolean }[]).map((o) => ({ id: o.id ?? nid(), content: o.content, isCorrect: o.isCorrect }));
    recordAudit(actor, 'UPDATE', 'QUESTION', id);
    save();
    return q;
  }
  if (method === 'DELETE') {
    quiz.questions = quiz.questions.filter((x) => x.id !== id);
    quiz.questions.forEach((x, i) => (x.orderIndex = i + 1));
    recordAudit(actor, 'DELETE', 'QUESTION', id);
    save();
    return undefined;
  }
}

// ---------- reviews
function reviewAdmin(r: AReview): any {
  const c = S.courses.find((x) => x.id === r.courseId);
  return { ...r, courseTitle: c?.title ?? 'Khóa học', courseSlug: c?.slug ?? '' };
}
function reviewsRoute(seg: string[], method: string, query: URLSearchParams, opts: Opts, actor: Actor): any {
  if (seg[2] === 'counts') {
    return { all: S.reviews.length, visible: S.reviews.filter((r) => !r.isHidden).length, hidden: S.reviews.filter((r) => r.isHidden).length };
  }
  if (seg.length === 2 && method === 'GET') {
    const hidden = query.get('hidden') ?? '';
    const rating = query.get('rating') ?? '';
    const q = (query.get('q') ?? '').toLowerCase().trim();
    const ratings = rating ? rating.split(',').map(Number) : [];
    let list = S.reviews.filter((r) => {
      if (hidden === 'true' && !r.isHidden) return false;
      if (hidden === 'false' && r.isHidden) return false;
      if (ratings.length && !ratings.includes(r.rating)) return false;
      if (q && !((r.comment ?? '').toLowerCase().includes(q) || r.authorName.toLowerCase().includes(q))) return false;
      return true;
    });
    list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return pageOf(list.map(reviewAdmin), Number(query.get('page') ?? 0), Number(query.get('size') ?? 20));
  }
  const id = Number(seg[2]);
  const r = S.reviews.find((x) => x.id === id);
  if (!r) err(404, 'REVIEW_NOT_FOUND', 'Không tìm thấy đánh giá');
  if (seg[3] === 'hide' && method === 'POST') {
    r!.isHidden = true;
    r!.hiddenReason = opts.body?.reason;
    r!.hiddenByName = actor.name;
    r!.hiddenAt = nowIso();
    recordAudit(actor, 'HIDE', 'COURSE_REVIEW', id, undefined, { reason: r!.hiddenReason });
    save();
    return undefined;
  }
  if (seg[3] === 'show' && method === 'POST') {
    r!.isHidden = false;
    r!.hiddenReason = undefined;
    r!.hiddenByName = undefined;
    r!.hiddenAt = undefined;
    recordAudit(actor, 'SHOW', 'COURSE_REVIEW', id);
    save();
    return undefined;
  }
}

// ---------- audit logs
function auditRoute(seg: string[], query: URLSearchParams): any {
  if (seg[2] === 'actors') {
    const ids = new Map<number, string>();
    S.audit.forEach((a) => { if (a.actorId) ids.set(a.actorId, a.actorName); });
    return [...ids.entries()].map(([id, fullName]) => ({ id, fullName }));
  }
  const actorId = query.get('actorId');
  const entityType = query.get('entityType');
  const actionType = query.get('actionType');
  const from = query.get('from');
  const to = query.get('to');
  let list = S.audit.filter((a) => {
    if (actorId && String(a.actorId) !== actorId) return false;
    if (entityType && a.entityType !== entityType) return false;
    if (actionType && a.actionType !== actionType) return false;
    if (from && new Date(a.createdAt) < new Date(from)) return false;
    if (to && new Date(a.createdAt) > new Date(to + 'T23:59:59')) return false;
    return true;
  });
  list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return pageOf(list, Number(query.get('page') ?? 0), Number(query.get('size') ?? 20));
}

// ---------- files (upload)
async function filesRoute(opts: Opts): Promise<any> {
  const file = opts.form?.get('file') as File | null;
  const name = file?.name ?? 'tep-tai-len';
  const type = file?.type ?? 'application/octet-stream';
  const size = file?.size ?? 0;
  let url = '#';
  if (file) {
    if (type.startsWith('image/')) url = await toDataUrl(file);
    else url = URL.createObjectURL(file);
  }
  const f: AFile = { id: nid(), url, originalName: name, contentType: type, sizeBytes: size };
  S.files[f.id] = f;
  save();
  return f;
}
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve('#');
    reader.readAsDataURL(file);
  });
}

function csv(s: string) {
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Khởi tạo kho dữ liệu admin SAU khi mọi helper (daysAgo, seed, ...) đã khai báo.
S = load();
