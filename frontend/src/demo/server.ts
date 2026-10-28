// Máy chủ giả lập chạy trên trình duyệt cho chế độ DEMO.
// Nhận (path, opts) giống api() và trả dữ liệu; ném ApiError cho lỗi nghiệp vụ.
// Trạng thái học (ghi danh, tiến độ, lượt quiz) lưu ở localStorage để demo giống thật.

import { ApiError } from '@/api/client';
import type {
  AnswerInput,
  AttemptHistoryItem,
  AttemptResult,
  AttemptView,
  CompleteResult,
  CourseCard,
  CourseDetail,
  CourseOverview,
  EnrollResult,
  HomeData,
  LessonContent,
  LessonItem,
  MyEnrollment,
  MyRank,
  Page,
  Profile,
  QuestionView,
  QuizInfo,
  RankingRow,
  ReviewPage,
  SubmitResult,
  TokenResponse,
  UserSummary,
} from '@/api/types';
import { DEMO_ACCOUNT } from './flag';
import {
  CATEGORIES,
  COURSES,
  ORG,
  categoryOf,
  courseBySlug,
  courseEstimatedMinutes,
  lessonById,
  quizById,
  type DCourse,
  type DQuestion,
} from './data';

// -------------------------------------------------------------------- trạng thái

interface EnrollState {
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  roundNo: number;
  learningStartedAt: string;
  expiresAt: string;
  completedAt?: string;
  completed: number[]; // lessonId đã hoàn thành (theo thứ tự)
  best: Record<number, number>; // lessonId -> % cao nhất
  bestPoints: Record<number, number>; // lessonId -> điểm thô cao nhất (cho xếp hạng)
  bestDuration: Record<number, number>; // lessonId -> thời gian lượt tốt nhất (giây)
  opened: Record<number, string>; // lessonId -> lần đầu mở (cho quy tắc 30 giây)
}

interface AttemptState {
  attemptId: number;
  quizId: number;
  lessonId: number;
  slug: string;
  attemptNo: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
  startedAt: string;
  expiresAt?: string;
  savedAnswers: AnswerInput[];
  score?: number;
  maxScore?: number;
  scorePercent?: number;
  passed?: boolean;
  durationSeconds?: number;
  submittedAt?: string;
}

interface DemoState {
  user: UserSummary | null;
  pendingName: string | null;
  nextAttemptId: number;
  enroll: Record<string, EnrollState>;
  attempts: Record<number, AttemptState>;
  reviews: Record<string, { rating: number; comment?: string; createdAt: string }>;
  profile: Partial<Profile>;
}

const STATE_KEY = 'bdhvs.demo.state';
const DEMO_USER_ID = 1000;

function freshState(): DemoState {
  return { user: null, pendingName: null, nextAttemptId: 500000, enroll: {}, attempts: {}, reviews: {}, profile: {} };
}

let state: DemoState = load();

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return { ...freshState(), ...JSON.parse(raw) };
  } catch {
    /* bỏ qua */
  }
  return freshState();
}
function save() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* bỏ qua */
  }
}

// -------------------------------------------------------------------- tiện ích

const nowIso = () => new Date().toISOString();
const addDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const err = (status: number, code: string, message: string): never => {
  throw new ApiError({ status, code, message });
};

function requireUser(): UserSummary {
  if (!state.user) err(401, 'UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return state.user!;
}

function makeUser(email: string, fullName: string): UserSummary {
  return { id: DEMO_USER_ID, fullName, email, roles: ['LEARNER'] };
}
function session(u: UserSummary): TokenResponse {
  return { accessToken: 'demo-token', expiresIn: 3600, user: u };
}

// Thumbnail nhẹ (gradient) nhúng sẵn — để trống, UI tự vẽ ô màu theo id.
const thumb = undefined;

// -------------------------------------------------------------------- map DTO

function completedPrefix(c: DCourse, e: EnrollState): number {
  // Số bài hoàn thành liên tiếp tính từ đầu (luồng học tuần tự).
  let k = 0;
  for (const l of c.lessons) {
    if (e.completed.includes(l.id)) k++;
    else break;
  }
  return k;
}

function lessonState(c: DCourse, e: EnrollState, index: number): 'COMPLETED' | 'UNLOCKED' | 'LOCKED' {
  const k = completedPrefix(c, e);
  if (index < k) return 'COMPLETED';
  if (index === k) return 'UNLOCKED';
  return 'LOCKED';
}

function progressPercent(c: DCourse, e: EnrollState): number {
  return Math.round((e.completed.length / c.lessons.length) * 100);
}

function currentLessonId(c: DCourse, e: EnrollState): number {
  const k = completedPrefix(c, e);
  const l = c.lessons[Math.min(k, c.lessons.length - 1)];
  return l.id;
}

function enrollmentDto(c: DCourse, e: EnrollState): MyEnrollment {
  return {
    id: c.id * 100 + e.roundNo,
    status: e.status,
    progressPercent: progressPercent(c, e),
    completedLessonCount: e.completed.length,
    learningStartedAt: e.learningStartedAt,
    expiresAt: e.expiresAt,
    completedAt: e.completedAt,
    roundNo: e.roundNo,
    lastLessonId: currentLessonId(c, e),
  };
}

function activeEnroll(slug: string): EnrollState | undefined {
  const e = state.enroll[slug];
  if (e && (e.status === 'IN_PROGRESS' || e.status === 'COMPLETED')) return e;
  return undefined;
}

function courseCard(c: DCourse): CourseCard {
  const { parent, child } = categoryOf(c.categoryId);
  const e = state.user ? state.enroll[c.slug] : undefined;
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    shortDescription: c.shortDescription,
    thumbnailUrl: thumb,
    level: c.level,
    timeStatus: 'OPEN',
    publishedLessonCount: c.lessons.length,
    estimatedMinutes: courseEstimatedMinutes(c),
    enrollmentCount: c.enrollmentCount,
    ratingAvg: c.ratingAvg,
    ratingCount: c.ratingCount,
    learningDurationDays: c.learningDurationDays,
    organizationId: ORG.id,
    organizationName: ORG.name,
    categoryId: child.id,
    categoryName: child.name,
    categorySlug: child.slug,
    parentCategoryId: parent.id,
    parentCategoryName: parent.name,
    myEnrollment: e ? enrollmentDto(c, e) : undefined,
  };
}

function courseDetail(c: DCourse): CourseDetail {
  const { parent, child } = categoryOf(c.categoryId);
  const e = state.user ? state.enroll[c.slug] : undefined;
  const canReview = !!e && (e.status === 'IN_PROGRESS' || e.status === 'COMPLETED') && e.completed.length >= 1;
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    shortDescription: c.shortDescription,
    description: c.description,
    outcomes: c.outcomes,
    targetAudience: c.targetAudience,
    prerequisites: c.prerequisites,
    thumbnailUrl: thumb,
    level: c.level,
    publishStatus: 'PUBLISHED',
    timeStatus: 'OPEN',
    publishedLessonCount: c.lessons.length,
    estimatedMinutes: courseEstimatedMinutes(c),
    enrollmentCount: c.enrollmentCount,
    ratingAvg: c.ratingAvg,
    ratingCount: c.ratingCount,
    learningDurationDays: c.learningDurationDays,
    certificateCriteria: JSON.stringify({ minProgress: 100, minAvgScorePercent: 70 }),
    organization: { id: ORG.id, name: ORG.name, slug: ORG.slug, description: ORG.description, courseCount: ORG.courseCount },
    category: { id: child.id, name: child.name, slug: child.slug },
    parentCategory: { id: parent.id, name: parent.name, slug: parent.slug },
    myEnrollment: e ? enrollmentDto(c, e) : undefined,
    canReview,
  };
}

function quizInfo(c: DCourse, lessonId: number): QuizInfo | undefined {
  const l = c.lessons.find((x) => x.id === lessonId)!;
  if (!l.quiz) return undefined;
  const e = state.enroll[c.slug];
  const attempts = Object.values(state.attempts).filter((a) => a.quizId === l.quiz!.id);
  const inProgress = attempts.find((a) => a.status === 'IN_PROGRESS');
  const best = e?.best[lessonId];
  return {
    id: l.quiz.id,
    title: l.quiz.title,
    questionCount: l.quiz.questions.length,
    timeLimitSeconds: l.quiz.timeLimitSeconds,
    passScorePercent: l.quiz.passScorePercent,
    maxAttempts: l.quiz.maxAttempts,
    usedAttempts: attempts.filter((a) => a.status !== 'IN_PROGRESS').length,
    retryCooldownSeconds: 0,
    inProgressAttemptId: inProgress?.attemptId,
    bestScorePercent: best,
    passed: best !== undefined && best >= l.quiz.passScorePercent,
  };
}

function publicQuestion(q: DQuestion): QuestionView {
  return { id: q.id, content: q.content, type: q.type, points: q.points, options: q.options.map((o) => ({ id: o.id, content: o.content })) };
}

// Chấm điểm một lượt làm.
function grade(quizId: number, answers: AnswerInput[]) {
  const found = quizById(quizId)!;
  const byQ: Record<number, number[]> = {};
  answers.forEach((a) => (byQ[a.questionId] = a.selectedOptionIds ?? []));
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  const detail = found.quiz.questions.map((q) => {
    maxScore += q.points;
    const sel = new Set(byQ[q.id] ?? []);
    const cor = new Set(q.correctOptionIds);
    const ok = sel.size === cor.size && [...cor].every((x) => sel.has(x));
    if (ok) {
      score += q.points;
      correctCount++;
    }
    return { q, selected: byQ[q.id] ?? [], ok };
  });
  const scorePercent = maxScore ? Math.round((score / maxScore) * 100) : 0;
  return { found, score, maxScore, scorePercent, correctCount, passed: scorePercent >= found.quiz.passScorePercent, detail };
}

// -------------------------------------------------------------------- xếp hạng

function myTotals(slug: string) {
  const e = state.enroll[slug];
  if (!e) return { totalScore: 0, totalDurationSeconds: 0, completedQuizCount: 0 };
  const totalScore = Object.values(e.bestPoints).reduce((a, b) => a + b, 0);
  const totalDurationSeconds = Object.values(e.bestDuration).reduce((a, b) => a + b, 0);
  const completedQuizCount = Object.keys(e.bestPoints).length;
  return { totalScore, totalDurationSeconds, completedQuizCount };
}

function rankingRows(c: DCourse): { userId: number; name: string; totalScore: number; totalDurationSeconds: number; completedQuizCount: number; me: boolean }[] {
  const rows = c.ranking.map((r) => ({ ...r, me: false }));
  const e = state.user ? state.enroll[c.slug] : undefined;
  const mine = myTotals(c.slug);
  if (state.user && e && mine.completedQuizCount > 0) {
    rows.push({ userId: state.user.id, name: state.user.fullName, ...mine, me: true });
  }
  rows.sort((a, b) => b.totalScore - a.totalScore || a.totalDurationSeconds - b.totalDurationSeconds);
  return rows;
}

// Rút gọn tên khi chưa đăng nhập (quyền riêng tư).
function shorten(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
}

// -------------------------------------------------------------------- bộ định tuyến

type Opts = { method?: string; body?: any; form?: FormData };

export async function handle(rawPath: string, opts: Opts = {}): Promise<any> {
  // Giả lập độ trễ mạng nhẹ cho tự nhiên.
  await new Promise((r) => setTimeout(r, 120));
  const method = (opts.method ?? 'GET').toUpperCase();
  const [path, queryStr] = rawPath.split('?');
  const query = new URLSearchParams(queryStr ?? '');
  const seg = path.split('/').filter(Boolean); // bỏ phần rỗng

  // ===== AUTH =====
  if (seg[0] === 'auth') {
    const action = seg[1];
    if (action === 'login') {
      const { email, password } = opts.body ?? {};
      if (!email || !password) err(422, 'VALIDATION_ERROR', 'Vui lòng nhập email và mật khẩu');
      const name = email === DEMO_ACCOUNT.email ? DEMO_ACCOUNT.fullName : state.pendingName || deriveName(email);
      const u = makeUser(email, name);
      state.user = u;
      save();
      return session(u);
    }
    if (action === 'register') {
      state.pendingName = opts.body?.fullName ?? null;
      save();
      return undefined; // sau đó UI chuyển sang xác thực OTP
    }
    if (action === 'verify-otp') {
      const email = opts.body?.email ?? 'nguoihoc@demo.vn';
      const u = makeUser(email, state.pendingName || deriveName(email));
      state.user = u;
      save();
      return session(u);
    }
    if (action === 'resend-otp' || action === 'forgot-password') {
      if (seg[2] === 'verify') return { resetToken: 'demo-reset-token' };
      return undefined;
    }
    if (action === 'reset-password') return undefined;
    if (action === 'logout') {
      state.user = null;
      save();
      return undefined;
    }
  }

  // ===== PROFILE =====
  if (path === '/me' && method === 'GET') return profileDto();
  if (path === '/me' && method === 'PUT') {
    state.profile = { ...state.profile, ...opts.body };
    if (state.user && opts.body?.fullName) state.user.fullName = opts.body.fullName;
    save();
    return profileDto();
  }
  if (path === '/me/password' && method === 'PUT') return undefined;
  if (path === '/me/avatar' && method === 'POST') return profileDto();
  if (path === '/me/enrollments' && method === 'GET') {
    requireUser();
    const status = query.get('status') ?? undefined;
    const cards = COURSES.filter((c) => state.enroll[c.slug] && ['IN_PROGRESS', 'COMPLETED'].includes(state.enroll[c.slug].status))
      .map(courseCard)
      .filter((c) => !status || c.myEnrollment?.status === status);
    return page(cards);
  }

  // ===== CATEGORIES / HOME =====
  if (path === '/categories' && method === 'GET') return categoriesDto();
  if (path === '/home' && method === 'GET') return homeDto();

  // ===== COURSES (list / facets / detail / lessons / reviews / ranking / enroll) =====
  if (seg[0] === 'courses') {
    // /courses, /courses/facets
    if (seg.length === 1) return listCourses(query);
    if (seg[1] === 'facets' && seg.length === 2) return facetsDto();

    const slug = seg[1];
    const c = courseBySlug(slug);
    if (!c) err(404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học');

    if (seg.length === 2 && method === 'GET') return courseDetail(c!);
    if (seg[2] === 'lessons' && method === 'GET') return syllabusDto(c!);
    if (seg[2] === 'reviews') return reviewsRoute(c!, seg, method, query, opts);
    if (seg[2] === 'ranking') {
      if (seg[3] === 'me') return myRankDto(c!);
      return rankingPage(c!, query);
    }
    if (seg[2] === 'enroll') {
      if (method === 'POST') return enroll(c!);
      if (method === 'DELETE') {
        if (state.enroll[slug]) {
          state.enroll[slug].status = 'CANCELLED';
          save();
        }
        return undefined;
      }
    }
  }

  // ===== LEARNING =====
  if (seg[0] === 'learning') return learningRoute(seg, method, opts);

  // Không khớp — trả lỗi rõ ràng để dễ phát hiện khi mở rộng demo.
  return err(404, 'DEMO_NOT_IMPLEMENTED', `DEMO chưa hỗ trợ: ${method} ${path}`);
}

// -------------------------------------------------------------------- handlers

function deriveName(email: string) {
  const local = String(email).split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!local) return 'Người học Demo';
  return local.replace(/\b\w/g, (m) => m.toUpperCase());
}

function profileDto(): Profile {
  const u = state.user ?? makeUser('nguoihoc@demo.vn', 'Người học Demo');
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    avatarUrl: u.avatarUrl,
    showOnLeaderboard: state.profile.showOnLeaderboard ?? true,
    createdAt: '2026-10-01T00:00:00Z',
    emailVerifiedAt: '2026-10-01T00:00:00Z',
    roles: u.roles,
    birthYear: state.profile.birthYear,
    hometown: state.profile.hometown,
    workplace: state.profile.workplace,
    phone: state.profile.phone,
  };
}

function page<T>(items: T[], p = 0, size = 50): Page<T> {
  return { items, page: p, size, totalItems: items.length, totalPages: Math.max(1, Math.ceil(items.length / size)) };
}

function categoriesDto() {
  return CATEGORIES.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    courseCount: COURSES.filter((c) => p.children.some((ch) => ch.id === c.categoryId)).length,
    children: p.children.map((ch) => ({
      id: ch.id,
      name: ch.name,
      slug: ch.slug,
      courseCount: COURSES.filter((c) => c.categoryId === ch.id).length,
      children: [],
    })),
  }));
}

function homeDto(): HomeData {
  const cards = COURSES.map(courseCard);
  return {
    featured: COURSES.filter((c) => c.featured).map(courseCard),
    newest: cards,
    categories: categoriesDto(),
    stats: {
      courses: COURSES.length,
      learners: COURSES.reduce((s, c) => s + c.enrollmentCount, 0),
      organizations: 1,
      ratingX100: Math.round((COURSES.reduce((s, c) => s + c.ratingAvg, 0) / COURSES.length) * 100),
    },
  };
}

function listCourses(query: URLSearchParams): Page<CourseCard> {
  const q = (query.get('q') ?? '').toLowerCase().trim();
  const cats = (query.get('category') ?? '').split(',').filter(Boolean);
  const levels = (query.get('level') ?? '').split(',').filter(Boolean);
  const orgs = (query.get('organization') ?? '').split(',').filter(Boolean);
  const myStatus = (query.get('myStatus') ?? '').split(',').filter(Boolean);
  const sort = query.get('sort') ?? 'popular';
  const p = Number(query.get('page') ?? 0);
  const size = Number(query.get('size') ?? 12);

  let list = COURSES.slice();
  if (q) list = list.filter((c) => (c.title + ' ' + c.shortDescription).toLowerCase().includes(q));
  if (cats.length) list = list.filter((c) => cats.includes(categoryOf(c.categoryId).child.slug) || cats.includes(categoryOf(c.categoryId).parent.slug));
  if (levels.length) list = list.filter((c) => levels.includes(c.level));
  if (orgs.length) list = list.filter(() => orgs.includes(String(ORG.id)));

  let cards = list.map(courseCard);
  if (myStatus.length) {
    cards = cards.filter((c) => {
      const s = c.myEnrollment?.status;
      if (myStatus.includes('NOT_ENROLLED') && !s) return true;
      return s ? myStatus.includes(s) : false;
    });
  }
  if (sort === 'rating') cards.sort((a, b) => b.ratingAvg - a.ratingAvg);
  else if (sort === 'newest') cards.reverse();
  else cards.sort((a, b) => b.enrollmentCount - a.enrollmentCount);

  const start = p * size;
  const pageItems = cards.slice(start, start + size);
  return { items: pageItems, page: p, size, totalItems: cards.length, totalPages: Math.max(1, Math.ceil(cards.length / size)) };
}

function facetsDto() {
  const levelVals = ['BASIC', 'INTERMEDIATE', 'ADVANCED'].map((v) => ({
    value: v,
    label: { BASIC: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao' }[v]!,
    count: COURSES.filter((c) => c.level === v).length,
  })).filter((f) => f.count > 0);
  const catVals = CATEGORIES.flatMap((p) =>
    p.children.map((ch) => ({ value: ch.slug, label: ch.name, count: COURSES.filter((c) => c.categoryId === ch.id).length })),
  ).filter((f) => f.count > 0);
  const orgVals = [{ value: String(ORG.id), label: ORG.name, count: COURSES.length }];
  return { groups: { level: levelVals, category: catVals, organization: orgVals } };
}

function syllabusDto(c: DCourse): LessonItem[] {
  const e = state.user ? state.enroll[c.slug] : undefined;
  const enrolled = e && ['IN_PROGRESS', 'COMPLETED'].includes(e.status);
  return c.lessons.map((l, i) => ({
    id: l.id,
    orderIndex: l.orderIndex,
    title: l.title,
    estimatedMinutes: l.estimatedMinutes,
    hasQuiz: !!l.quiz,
    state: enrolled ? lessonState(c, e!, i) : undefined,
    bestScorePercent: enrolled ? e!.best[l.id] : undefined,
  }));
}

function reviewsRoute(c: DCourse, seg: string[], method: string, query: URLSearchParams, opts: Opts): any {
  // POST /courses/:slug/reviews | PUT|DELETE /courses/:slug/reviews/me
  if (method === 'POST' || (seg[3] === 'me' && method === 'PUT')) {
    state.reviews[c.slug] = { rating: opts.body.rating, comment: opts.body.comment, createdAt: nowIso() };
    save();
    return undefined;
  }
  if (seg[3] === 'me' && method === 'DELETE') {
    delete state.reviews[c.slug];
    save();
    return undefined;
  }
  // GET danh sách đánh giá
  const p = Number(query.get('page') ?? 0);
  const my = state.reviews[c.slug];
  const e = state.enroll[c.slug];
  const canReview = !!e && ['IN_PROGRESS', 'COMPLETED'].includes(e.status) && e.completed.length >= 1;
  const dist: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
  c.reviews.forEach((r) => (dist[String(r.rating)] = (dist[String(r.rating)] ?? 0) + 1));
  const items = c.reviews.map((r) => ({
    id: r.id,
    userId: r.userId,
    authorName: r.authorName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    updatedAt: r.createdAt,
  }));
  const result: ReviewPage = {
    summary: { average: c.ratingAvg, count: c.ratingCount, distribution: dist },
    items,
    page: p,
    size: 10,
    totalItems: items.length,
    totalPages: 1,
    canReview,
    myReview: my && state.user
      ? { id: 999999, userId: state.user.id, authorName: state.user.fullName, rating: my.rating, comment: my.comment, createdAt: my.createdAt, updatedAt: my.createdAt }
      : undefined,
  };
  return result;
}

function rankingPage(c: DCourse, query: URLSearchParams): Page<RankingRow> {
  const p = Number(query.get('page') ?? 0);
  const size = Number(query.get('size') ?? 20);
  const rows = rankingRows(c);
  const mapped: RankingRow[] = rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    displayName: r.me || state.user ? r.name : shorten(r.name),
    totalScore: r.totalScore,
    totalDurationSeconds: r.totalDurationSeconds,
    completedQuizCount: r.completedQuizCount,
    me: r.me,
  }));
  const start = p * size;
  return { items: mapped.slice(start, start + size), page: p, size, totalItems: mapped.length, totalPages: Math.max(1, Math.ceil(mapped.length / size)) };
}

function myRankDto(c: DCourse): MyRank {
  const rows = rankingRows(c);
  const idx = rows.findIndex((r) => r.me);
  if (idx < 0) return { totalRanked: rows.length };
  const me = rows[idx];
  return {
    rank: idx + 1,
    totalRanked: rows.length,
    totalScore: me.totalScore,
    totalDurationSeconds: me.totalDurationSeconds,
    completedQuizCount: me.completedQuizCount,
  };
}

function enroll(c: DCourse): EnrollResult {
  requireUser();
  const prev = state.enroll[c.slug];
  const roundNo = prev ? (prev.status === 'EXPIRED' ? prev.roundNo + 1 : prev.roundNo) : 1;
  const e: EnrollState = {
    status: 'IN_PROGRESS',
    roundNo,
    learningStartedAt: nowIso(),
    expiresAt: addDays(c.learningDurationDays),
    completed: prev && prev.status === 'CANCELLED' ? prev.completed : [],
    best: prev && prev.status === 'CANCELLED' ? prev.best : {},
    bestPoints: prev && prev.status === 'CANCELLED' ? prev.bestPoints : {},
    bestDuration: prev && prev.status === 'CANCELLED' ? prev.bestDuration : {},
    opened: prev && prev.status === 'CANCELLED' ? prev.opened : {},
  };
  state.enroll[c.slug] = e;
  save();
  return {
    enrollmentId: c.id * 100 + roundNo,
    status: e.status,
    roundNo,
    progressPercent: progressPercent(c, e),
    learningStartedAt: e.learningStartedAt,
    expiresAt: e.expiresAt,
    learningDurationDays: c.learningDurationDays,
  } as EnrollResult;
}

// -------------------------------------------------------------------- learning

function learningRoute(seg: string[], method: string, opts: Opts): any {
  requireUser();
  const kind = seg[1];

  // GET /learning/courses/:slug
  if (kind === 'courses' && seg.length === 3 && method === 'GET') {
    const slug = seg[2];
    const c = courseBySlug(slug);
    if (!c) err(404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học');
    const e = activeEnroll(slug);
    if (!e) {
      if (state.enroll[slug]?.status === 'EXPIRED') err(403, 'ENROLLMENT_EXPIRED', 'Thời hạn học đã kết thúc');
      err(403, 'NOT_ENROLLED', 'Bạn chưa đăng ký khóa học này');
    }
    return courseOverview(c!, e!);
  }

  // GET /learning/lessons/:id  |  POST /learning/lessons/:id/complete
  if (kind === 'lessons') {
    const lessonId = Number(seg[2]);
    const found = lessonById(lessonId);
    if (!found) err(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
    const { course, lesson } = found!;
    const e = activeEnroll(course.slug);
    if (!e) err(403, 'NOT_ENROLLED', 'Bạn chưa đăng ký khóa học này');
    const index = course.lessons.findIndex((x) => x.id === lessonId);
    const st = lessonState(course, e!, index);

    if (seg[3] === 'complete' && method === 'POST') {
      if (lesson.quiz && (e!.best[lessonId] ?? -1) < lesson.quiz.passScorePercent) {
        err(422, 'QUIZ_REQUIRED', 'Bạn cần đạt quiz để hoàn thành bài này');
      }
      return completeLesson(course, e!, lessonId);
    }

    if (method === 'GET') {
      if (st === 'LOCKED') err(403, 'LESSON_LOCKED', 'Bài học chưa được mở khóa');
      if (!e!.opened[lessonId]) {
        e!.opened[lessonId] = nowIso();
        save();
      }
      return lessonContent(course, e!, lessonId);
    }
  }

  // Quiz & attempts
  if (kind === 'quizzes') {
    const quizId = Number(seg[2]);
    const found = quizById(quizId);
    if (!found) err(404, 'QUIZ_NOT_FOUND', 'Không tìm thấy quiz');
    if (seg[3] === 'attempts' && method === 'GET') return attemptHistory(quizId);
    if (seg[3] === 'attempts' && method === 'POST') return startAttempt(found!.course.slug, found!.lesson.id, quizId);
  }

  if (kind === 'attempts') {
    const attemptId = Number(seg[2]);
    const a = state.attempts[attemptId];
    if (!a) err(404, 'ATTEMPT_NOT_FOUND', 'Không tìm thấy lượt làm bài');
    if (seg[3] === undefined && method === 'GET') {
      if (a!.status !== 'IN_PROGRESS') err(409, 'ATTEMPT_SUBMITTED', 'Lượt làm đã được nộp');
      return attemptView(a!);
    }
    if (seg[3] === 'answers' && method === 'PUT') {
      a!.savedAnswers = opts.body?.answers ?? [];
      save();
      return undefined;
    }
    if (seg[3] === 'submit' && method === 'POST') return submitAttempt(a!, opts.body?.answers ?? []);
    if (seg[3] === 'result' && method === 'GET') return attemptResult(a!);
  }

  return err(404, 'DEMO_NOT_IMPLEMENTED', `DEMO chưa hỗ trợ: ${method} /${seg.join('/')}`);
}

function courseOverview(c: DCourse, e: EnrollState): CourseOverview {
  return {
    courseId: c.id,
    slug: c.slug,
    title: c.title,
    learningDurationDays: c.learningDurationDays,
    timeStatus: 'OPEN',
    enrollment: enrollmentDto(c, e),
    lessons: c.lessons.map((l, i) => ({
      id: l.id,
      orderIndex: l.orderIndex,
      title: l.title,
      estimatedMinutes: l.estimatedMinutes,
      hasQuiz: !!l.quiz,
      state: lessonState(c, e, i),
      bestScorePercent: e.best[l.id],
    })),
    lastLessonId: currentLessonId(c, e),
  };
}

function lessonContent(c: DCourse, e: EnrollState, lessonId: number): LessonContent {
  const index = c.lessons.findIndex((x) => x.id === lessonId);
  const l = c.lessons[index];
  return {
    id: l.id,
    courseId: c.id,
    courseSlug: c.slug,
    courseTitle: c.title,
    orderIndex: l.orderIndex,
    lessonCount: c.lessons.length,
    title: l.title,
    content: l.content,
    videoUrl: l.videoUrl,
    assignment: l.assignment,
    estimatedMinutes: l.estimatedMinutes,
    state: lessonState(c, e, index),
    startedAt: e.opened[lessonId] ?? nowIso(),
    attachments: l.attachments ?? [],
    quiz: quizInfo(c, lessonId),
    previousLessonId: c.lessons[index - 1]?.id,
    nextLessonId: c.lessons[index + 1]?.id,
    enrollmentExpiresAt: e.expiresAt,
  };
}

function completeLesson(c: DCourse, e: EnrollState, lessonId: number): CompleteResult {
  if (!e.completed.includes(lessonId)) e.completed.push(lessonId);
  // Giữ thứ tự theo giáo trình.
  e.completed.sort((a, b) => c.lessons.findIndex((x) => x.id === a) - c.lessons.findIndex((x) => x.id === b));
  const index = c.lessons.findIndex((x) => x.id === lessonId);
  const next = c.lessons[index + 1];
  const courseCompleted = e.completed.length === c.lessons.length;
  if (courseCompleted && e.status !== 'COMPLETED') {
    e.status = 'COMPLETED';
    e.completedAt = nowIso();
  }
  save();
  return {
    lessonCompleted: true,
    nextLessonUnlocked: next ? { id: next.id, title: next.title } : undefined,
    courseProgressPercent: progressPercent(c, e),
    courseCompleted,
  };
}

function attemptHistory(quizId: number): AttemptHistoryItem[] {
  const list = Object.values(state.attempts).filter((a) => a.quizId === quizId);
  const submitted = list.filter((a) => a.status !== 'IN_PROGRESS');
  const bestPct = Math.max(-1, ...submitted.map((a) => a.scorePercent ?? -1));
  let bestMarked = false;
  return list
    .sort((a, b) => b.attemptNo - a.attemptNo)
    .map((a) => {
      const isBest = a.status !== 'IN_PROGRESS' && a.scorePercent === bestPct && !bestMarked && ((bestMarked = true), true);
      return {
        id: a.attemptId,
        attemptNo: a.attemptNo,
        status: a.status,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        score: a.score,
        maxScore: a.maxScore,
        scorePercent: a.scorePercent,
        passed: a.passed,
        durationSeconds: a.durationSeconds,
        best: !!isBest,
      };
    });
}

function startAttempt(slug: string, lessonId: number, quizId: number): { attemptId: number } {
  const existing = Object.values(state.attempts).find((a) => a.quizId === quizId && a.status === 'IN_PROGRESS');
  if (existing) return { attemptId: existing.attemptId };
  const found = quizById(quizId)!;
  const attemptNo = Object.values(state.attempts).filter((a) => a.quizId === quizId).length + 1;
  const attemptId = state.nextAttemptId++;
  state.attempts[attemptId] = {
    attemptId,
    quizId,
    lessonId,
    slug,
    attemptNo,
    status: 'IN_PROGRESS',
    startedAt: nowIso(),
    expiresAt: found.quiz.timeLimitSeconds ? new Date(Date.now() + found.quiz.timeLimitSeconds * 1000).toISOString() : undefined,
    savedAnswers: [],
  };
  save();
  return { attemptId };
}

function attemptView(a: AttemptState): AttemptView {
  const found = quizById(a.quizId)!;
  return {
    attemptId: a.attemptId,
    quizId: a.quizId,
    lessonId: a.lessonId,
    courseSlug: a.slug,
    quizTitle: found.quiz.title,
    attemptNo: a.attemptNo,
    status: a.status,
    startedAt: a.startedAt,
    expiresAt: a.expiresAt,
    enrollmentExpiresAt: state.enroll[a.slug]?.expiresAt ?? addDays(21),
    passScorePercent: found.quiz.passScorePercent,
    questions: found.quiz.questions.map(publicQuestion),
    savedAnswers: a.savedAnswers,
  };
}

function submitAttempt(a: AttemptState, answers: AnswerInput[]): SubmitResult {
  if (a.status !== 'IN_PROGRESS') err(409, 'ATTEMPT_SUBMITTED', 'Lượt làm đã được nộp');
  const g = grade(a.quizId, answers);
  const c = g.found.course;
  const e = state.enroll[a.slug]!;
  const durationSeconds = Math.max(1, Math.round((Date.now() - new Date(a.startedAt).getTime()) / 1000));
  a.status = 'SUBMITTED';
  a.savedAnswers = answers;
  a.score = g.score;
  a.maxScore = g.maxScore;
  a.scorePercent = g.scorePercent;
  a.passed = g.passed;
  a.durationSeconds = durationSeconds;
  a.submittedAt = nowIso();

  // Cập nhật điểm tốt nhất (cho hiển thị & xếp hạng).
  const prevBest = e.best[a.lessonId] ?? -1;
  if (g.scorePercent > prevBest) {
    e.best[a.lessonId] = g.scorePercent;
    e.bestPoints[a.lessonId] = g.score;
    e.bestDuration[a.lessonId] = durationSeconds;
  } else if (e.bestPoints[a.lessonId] === undefined) {
    e.bestPoints[a.lessonId] = g.score;
    e.bestDuration[a.lessonId] = durationSeconds;
  }

  // Đạt quiz → hoàn thành bài.
  let courseCompleted = false;
  let nextLesson: { id: number; title: string } | undefined;
  if (g.passed) {
    const res = completeLesson(c, e, a.lessonId);
    courseCompleted = res.courseCompleted;
    nextLesson = res.nextLessonUnlocked;
  }
  save();

  const rank = myRankDto(c).rank;
  return {
    attemptId: a.attemptId,
    score: g.score,
    maxScore: g.maxScore,
    scorePercent: g.scorePercent,
    passed: g.passed,
    durationSeconds,
    correctCount: g.correctCount,
    questionCount: g.found.quiz.questions.length,
    lessonCompleted: g.passed,
    nextLessonUnlocked: nextLesson,
    courseProgressPercent: progressPercent(c, e),
    courseCompleted,
    ranking: rank ? { rank, totalScore: myTotals(a.slug).totalScore, totalDurationSeconds: myTotals(a.slug).totalDurationSeconds } : undefined,
  };
}

function attemptResult(a: AttemptState): AttemptResult {
  if (a.status === 'IN_PROGRESS') err(409, 'ATTEMPT_NOT_SUBMITTED', 'Lượt làm chưa được nộp');
  const found = quizById(a.quizId)!;
  const c = found.course;
  const e = state.enroll[a.slug];
  const byQ: Record<number, number[]> = {};
  a.savedAnswers.forEach((x) => (byQ[x.questionId] = x.selectedOptionIds ?? []));
  const index = c.lessons.findIndex((x) => x.id === a.lessonId);
  const nextL = c.lessons[index + 1];
  const isBest = (e?.best[a.lessonId] ?? -1) === (a.scorePercent ?? -1);
  return {
    attemptId: a.attemptId,
    quizId: a.quizId,
    lessonId: a.lessonId,
    courseSlug: a.slug,
    lessonTitle: found.lesson.title,
    attemptNo: a.attemptNo,
    status: a.status,
    score: a.score ?? 0,
    maxScore: a.maxScore ?? 0,
    scorePercent: a.scorePercent ?? 0,
    passed: a.passed ?? false,
    durationSeconds: a.durationSeconds ?? 0,
    submittedAt: a.submittedAt ?? nowIso(),
    passScorePercent: found.quiz.passScorePercent,
    showAnswers: true,
    isBest,
    questions: found.quiz.questions.map((q) => {
      const sel = new Set(byQ[q.id] ?? []);
      const cor = new Set(q.correctOptionIds);
      const ok = sel.size === cor.size && [...cor].every((x) => sel.has(x));
      return {
        id: q.id,
        content: q.content,
        type: q.type,
        points: q.points,
        pointsAwarded: ok ? q.points : 0,
        isCorrect: ok,
        explanation: q.explanation,
        options: q.options.map((o) => ({ id: o.id, content: o.content, selected: sel.has(o.id), correct: cor.has(o.id) })),
      };
    }),
    nextLesson: a.passed && nextL ? { id: nextL.id, title: nextL.title } : undefined,
    courseProgressPercent: e ? progressPercent(c, e) : 0,
    rank: myRankDto(c).rank,
  };
}

// -------------------------------------------------------------------- phiên demo

/** Khôi phục phiên khi tải trang (thay cho /auth/refresh). */
export function demoRefresh(): TokenResponse | null {
  return state.user ? session(state.user) : null;
}
