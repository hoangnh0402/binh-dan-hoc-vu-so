// Kiểu dữ liệu khớp DTO của backend (vn.bdhvs.*Dtos).

export type Level = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
export type TimeStatus = 'UPCOMING' | 'OPEN' | 'ENDED';
export type EnrollmentStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type LessonState = 'COMPLETED' | 'IN_PROGRESS' | 'UNLOCKED' | 'LOCKED';

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
  errors?: { field: string; message: string }[];
  traceId?: string;
}

export interface UserSummary {
  id: number;
  fullName: string;
  email: string;
  avatarUrl?: string;
  roles: string[];
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  user: UserSummary;
}

export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  courseCount: number;
  children: CategoryNode[];
}

export interface OrganizationItem {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  courseCount: number;
}

export interface MyEnrollment {
  id: number;
  status: EnrollmentStatus;
  progressPercent: number;
  completedLessonCount: number;
  learningStartedAt: string;
  expiresAt: string;
  expiredAt?: string;
  completedAt?: string;
  roundNo: number;
  lastLessonId?: number;
}

export interface CourseCard {
  id: number;
  slug: string;
  title: string;
  shortDescription: string;
  thumbnailUrl?: string;
  level: Level;
  timeStatus: TimeStatus;
  startDate?: string;
  endDate?: string;
  publishedLessonCount: number;
  estimatedMinutes?: number;
  enrollmentCount: number;
  ratingAvg: number;
  ratingCount: number;
  learningDurationDays: number;
  organizationId: number;
  organizationName: string;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  parentCategoryId: number;
  parentCategoryName: string;
  myEnrollment?: MyEnrollment;
}

export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

export interface CourseDetail {
  id: number;
  slug: string;
  title: string;
  shortDescription: string;
  description?: string;
  outcomes?: string;
  targetAudience?: string;
  prerequisites?: string;
  thumbnailUrl?: string;
  level: Level;
  publishStatus: string;
  timeStatus: TimeStatus;
  startDate?: string;
  endDate?: string;
  publishedLessonCount: number;
  estimatedMinutes?: number;
  enrollmentCount: number;
  ratingAvg: number;
  ratingCount: number;
  learningDurationDays: number;
  certificateCriteria?: string;
  organization: { id: number; name: string; slug: string; logoUrl?: string; description?: string; courseCount: number };
  category: { id: number; name: string; slug: string };
  parentCategory: { id: number; name: string; slug: string };
  myEnrollment?: MyEnrollment;
  canReview: boolean;
}

export interface LessonItem {
  id: number;
  orderIndex: number;
  title: string;
  estimatedMinutes?: number;
  hasQuiz: boolean;
  state?: LessonState;
  bestScorePercent?: number;
}

export interface HomeData {
  featured: CourseCard[];
  newest: CourseCard[];
  categories: CategoryNode[];
  stats: { courses: number; learners: number; organizations: number; ratingX100: number };
}

export interface ReviewItem {
  id: number;
  userId: number;
  authorName: string;
  authorAvatarUrl?: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewPage {
  summary: { average: number; count: number; distribution: Record<string, number> };
  items: ReviewItem[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  myReview?: ReviewItem;
  canReview: boolean;
}

export interface RankingRow {
  rank: number;
  userId: number;
  displayName: string;
  avatarUrl?: string;
  totalScore: number;
  totalDurationSeconds: number;
  completedQuizCount: number;
  me: boolean;
}

export interface MyRank {
  rank?: number;
  totalRanked: number;
  totalScore?: number;
  totalDurationSeconds?: number;
  completedQuizCount?: number;
}

export interface EnrollResult {
  enrollmentId: number;
  status: EnrollmentStatus;
  roundNo: number;
  progressPercent: number;
  learningStartedAt: string;
  expiresAt: string;
  learningDurationDays: number;
}

// ---------------- học tập

export interface CourseOverview {
  courseId: number;
  slug: string;
  title: string;
  learningDurationDays: number;
  timeStatus: TimeStatus;
  enrollment: MyEnrollment;
  lessons: LessonItem[];
  lastLessonId?: number;
}

export interface QuizInfo {
  id: number;
  title: string;
  questionCount: number;
  timeLimitSeconds?: number;
  passScorePercent: number;
  maxAttempts?: number;
  usedAttempts: number;
  retryCooldownSeconds: number;
  nextAttemptAt?: string;
  inProgressAttemptId?: number;
  bestScorePercent?: number;
  passed: boolean;
}

export interface LessonContent {
  id: number;
  courseId: number;
  courseSlug: string;
  courseTitle: string;
  orderIndex: number;
  lessonCount: number;
  title: string;
  content?: string;
  videoUrl?: string;
  assignment?: string;
  estimatedMinutes?: number;
  state: LessonState;
  startedAt: string;
  attachments: { id: number; name: string; url: string; contentType: string; sizeBytes: number }[];
  quiz?: QuizInfo;
  previousLessonId?: number;
  nextLessonId?: number;
  enrollmentExpiresAt: string;
}

export interface LessonRef {
  id: number;
  title: string;
}

export interface CompleteResult {
  lessonCompleted: boolean;
  nextLessonUnlocked?: LessonRef;
  courseProgressPercent: number;
  courseCompleted: boolean;
}

export interface QuestionView {
  id: number;
  content: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  points: number;
  options: { id: number; content: string }[];
}

export interface AnswerInput {
  questionId: number;
  selectedOptionIds: number[];
}

export interface AttemptView {
  attemptId: number;
  quizId: number;
  lessonId: number;
  courseSlug: string;
  quizTitle: string;
  attemptNo: number;
  status: string;
  startedAt: string;
  expiresAt?: string;
  enrollmentExpiresAt: string;
  passScorePercent: number;
  questions: QuestionView[];
  savedAnswers: AnswerInput[];
}

export interface SubmitResult {
  attemptId: number;
  score: number;
  maxScore: number;
  scorePercent: number;
  passed: boolean;
  durationSeconds: number;
  correctCount: number;
  questionCount: number;
  lessonCompleted: boolean;
  nextLessonUnlocked?: LessonRef;
  courseProgressPercent: number;
  courseCompleted: boolean;
  ranking?: { rank: number; totalScore: number; totalDurationSeconds: number };
}

export interface AttemptResult {
  attemptId: number;
  quizId: number;
  lessonId: number;
  courseSlug: string;
  lessonTitle: string;
  attemptNo: number;
  status: string;
  score: number;
  maxScore: number;
  scorePercent: number;
  passed: boolean;
  durationSeconds: number;
  submittedAt: string;
  passScorePercent: number;
  showAnswers: boolean;
  isBest: boolean;
  questions: {
    id: number;
    content: string;
    type: string;
    points: number;
    pointsAwarded: number;
    isCorrect: boolean;
    explanation?: string;
    options: { id: number; content: string; selected: boolean; correct?: boolean }[];
  }[];
  nextLesson?: LessonRef;
  courseProgressPercent: number;
  rank?: number;
}

export interface AttemptHistoryItem {
  id: number;
  attemptNo: number;
  status: string;
  startedAt: string;
  submittedAt?: string;
  score?: number;
  maxScore?: number;
  scorePercent?: number;
  passed?: boolean;
  durationSeconds?: number;
  best: boolean;
}

export interface Profile {
  id: number;
  email: string;
  fullName: string;
  birthYear?: number;
  hometown?: string;
  workplace?: string;
  phone?: string;
  avatarUrl?: string;
  showOnLeaderboard: boolean;
  emailVerifiedAt?: string;
  createdAt: string;
  roles: string[];
}
