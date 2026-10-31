import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/api/client';
import type { AnswerInput, AttemptHistoryItem, AttemptResult, AttemptView, CompleteResult, CourseCard as Card, CourseOverview, LessonContent, Page, SubmitResult } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Icon } from '@/components/Icon';
import { CourseCard } from '@/components/CourseCard';
import { Avatar } from '@/components/Layout';
import { ErrorBox, Html, Modal, Progress, Spinner, errorMessage, useConfirm, useCountdown, useToast } from '@/components/ui';
import { deadlineLevel, fileSize, formatClock, formatDate, formatDateTime, formatNumber, remaining } from '@/lib/format';

// ====================================================================== lỗi quyền học

/** Xử lý chung các lỗi 403 của /learning (BR-LRN-06, BR-LRN-10, BR-LRN-02). */
function AccessError({ error, slug }: { error: unknown; slug: string }) {
  const nav = useNavigate();
  if (error instanceof ApiError && error.code === 'ENROLLMENT_EXPIRED') {
    return (
      <Modal open onClose={() => nav(`/khoa-hoc/${slug}`)}>
        <div className="b">
          <div className="hd">
            <span className="ic red">
              <Icon name="hourglass" />
            </span>
            <div>
              <h3>Thời hạn học đã kết thúc</h3>
            </div>
          </div>
          <p>Tiến độ, điểm quiz và thứ hạng của lần học trước đã bị xóa. Bạn có thể đăng ký học lại từ bài 1 với thời hạn mới.</p>
        </div>
        <div className="f">
          <button className="btn btn-light" onClick={() => nav('/toi/khoa-hoc')}>
            Đóng
          </button>
          <button className="btn btn-primary" onClick={() => nav(`/khoa-hoc/${slug}`)}>
            <Icon name="refresh" size="sm" />
            Đăng ký học lại
          </button>
        </div>
      </Modal>
    );
  }
  if (error instanceof ApiError && ['NOT_ENROLLED', 'COURSE_NOT_STARTED'].includes(error.code)) {
    return (
      <div className="center-box">
        <Icon name="lock" size="lg" style={{ color: 'var(--red)' }} />
        <p>{error.message}</p>
        <Link className="btn btn-primary" to={`/khoa-hoc/${slug}`}>
          Về trang khóa học
        </Link>
      </div>
    );
  }
  return <ErrorBox error={error} />;
}

function LearnBar({ title, slug, children }: { title: string; slug: string; children?: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="lbar">
      <Link to="/">
        <img src="/logo-256.png" alt="Trang chủ Bình Dân Học Vụ Số" />
      </Link>
      <Link className="btn btn-light btn-sm" to={`/khoa-hoc/${slug}`}>
        <Icon name="chevron-left" size="sm" />
        Về khóa học
      </Link>
      <span className="ct">{title}</span>
      <span style={{ flex: 1 }} />
      {children}
      <Avatar name={user?.fullName} url={user?.avatarUrl} className="sm" />
    </div>
  );
}

function DeadlineBar({ expiresAt, left }: { expiresAt: string; left: number }) {
  const level = deadlineLevel(expiresAt);
  if (level !== 'warn' && level !== 'danger') return null;
  return (
    <div className={`warnbar${level === 'danger' ? ' danger' : ''}`} role="alert">
      <Icon name="alert" />
      <span>
        Thời hạn học còn <b>{remaining(expiresAt)}</b> (đến {formatDateTime(expiresAt)}). Bạn cần hoàn thành {left} bài còn lại, nếu không dữ liệu học tập sẽ bị xóa và phải học lại từ đầu.
      </span>
    </div>
  );
}

// ====================================================================== /hoc/:slug → bài đang học

export function LearnRedirect() {
  const { slug = '' } = useParams();
  const q = useQuery({ queryKey: ['learn', slug], queryFn: () => api<CourseOverview>(`/learning/courses/${slug}`), retry: false });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <AccessError error={q.error} slug={slug} />;
  const o = q.data!;
  if (!o.lastLessonId) return <Navigate to={`/khoa-hoc/${slug}`} replace />;
  return <Navigate to={`/hoc/${slug}/bai/${o.lastLessonId}`} replace />;
}

// ====================================================================== SCR-LRN-01 Trang học

export function LessonPage() {
  const { slug = '', lessonId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [fs, setFs] = useState(0);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [tab, setTab] = useState<'content' | 'assignment' | 'quiz'>('content');
  const overview = useQuery({ queryKey: ['learn', slug], queryFn: () => api<CourseOverview>(`/learning/courses/${slug}`), retry: false });
  const lesson = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => api<LessonContent>(`/learning/lessons/${lessonId}`), retry: false });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setTab('content');
    setOutlineOpen(false);
    window.scrollTo(0, 0);
  }, [lessonId]);

  const complete = useMutation({
    mutationFn: () => api<CompleteResult>(`/learning/lessons/${lessonId}/complete`, { method: 'POST' }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['learn', slug] });
      qc.invalidateQueries({ queryKey: ['lesson', lessonId] });
      if (r.courseCompleted) nav(`/hoc/${slug}/hoan-thanh`);
      else if (r.nextLessonUnlocked) {
        toast(`Đã mở khóa: ${r.nextLessonUnlocked.title}`);
        nav(`/hoc/${slug}/bai/${r.nextLessonUnlocked.id}`);
      } else toast('Đã đánh dấu học xong bài này');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  if (lesson.error instanceof ApiError && lesson.error.code === 'LESSON_LOCKED' && overview.data?.lastLessonId) {
    return <Navigate to={`/hoc/${slug}/bai/${overview.data.lastLessonId}`} replace />;
  }
  if (overview.error || lesson.error) return <AccessError error={overview.error ?? lesson.error} slug={slug} />;
  if (overview.isLoading || lesson.isLoading) return <Spinner />;
  const o = overview.data!;
  const l = lesson.data!;
  const e = o.enrollment;
  const left = o.lessons.filter((x) => x.state !== 'COMPLETED').length;
  const canMark = !l.quiz && l.state !== 'COMPLETED';
  const viewedEnough = now - new Date(l.startedAt).getTime() >= 30_000;

  return (
    <div className={`learn fs-${fs}`}>
      <LearnBar title={o.title} slug={slug}>
        <button className="btn btn-light btn-sm outline-toggle" onClick={() => setOutlineOpen(!outlineOpen)}>
          <Icon name="list" size="sm" />
          Bài học
        </button>
        <span className="small muted fs-label">Cỡ chữ</span>
        <div className="fs" role="group" aria-label="Cỡ chữ nội dung">
          {['A', 'A+', 'A++'].map((t, i) => (
            <button key={t} className={fs === i ? 'on' : ''} onClick={() => setFs(i)} aria-pressed={fs === i}>
              {t}
            </button>
          ))}
        </div>
      </LearnBar>
      {e.status === 'IN_PROGRESS' && <DeadlineBar expiresAt={e.expiresAt} left={left} />}
      <div className="lgrid">
        <aside className={`outline${outlineOpen ? ' open' : ''}`}>
          <div className="top">
            <div className="row-between">
              <span className="bold">Tiến độ khóa học</span>
              <span className="bold" style={{ color: 'var(--red)' }}>{e.progressPercent}%</span>
            </div>
            <Progress value={e.progressPercent} tone={e.status === 'COMPLETED' ? 'success' : deadlineLevel(e.expiresAt) === 'ok' ? undefined : 'warn'} />
            {e.status === 'IN_PROGRESS' ? (
              <span className={`deadline ${deadlineLevel(e.expiresAt) === 'ok' ? '' : 'warn'}`}>
                <Icon name="hourglass" size="sm" />
                Hạn học: còn {remaining(e.expiresAt)}
              </span>
            ) : (
              <span className="chip success" style={{ alignSelf: 'flex-start' }}>
                Đã hoàn thành khóa học
              </span>
            )}
          </div>
          {o.lessons.map((x, i) => {
            const cls = x.state === 'COMPLETED' ? 'done' : x.state === 'LOCKED' ? 'lock' : '';
            const current = String(x.id) === lessonId;
            return (
              <button
                key={x.id}
                className={`ol ${cls}${current ? ' cur' : ''}`}
                onClick={() => (x.state === 'LOCKED' ? toast(`Hoàn thành bài ${o.lessons[i - 1]?.orderIndex} để mở khóa bài này`, 'info') : nav(`/hoc/${slug}/bai/${x.id}`))}
                aria-current={current ? 'page' : undefined}
              >
                <Icon name={x.state === 'COMPLETED' ? 'check-circle' : x.state === 'LOCKED' ? 'lock' : 'play'} className="st" />
                <div>
                  <div className={current ? 'bold' : ''}>
                    {x.orderIndex}. {x.title}
                  </div>
                  <div className="sub">
                    {x.state === 'COMPLETED'
                      ? x.bestScorePercent !== undefined && x.bestScorePercent !== null
                        ? `Quiz đạt ${x.bestScorePercent}%`
                        : 'Đã học xong'
                      : x.state === 'LOCKED'
                        ? `Hoàn thành bài ${o.lessons[i - 1]?.orderIndex} để mở khóa`
                        : `Đang học${x.estimatedMinutes ? ` · ${x.estimatedMinutes} phút` : ''}`}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        <main className="content">
          <div>
            <div className="small muted">
              Bài {l.orderIndex} / {l.lessonCount}
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{l.title}</h1>
          </div>
          <nav className="tabs" role="tablist">
            <a role="tab" className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}>
              Nội dung
            </a>
            {l.assignment && (
              <a role="tab" className={tab === 'assignment' ? 'active' : ''} onClick={() => setTab('assignment')}>
                Đề bài
              </a>
            )}
            {l.quiz && (
              <a role="tab" className={tab === 'quiz' ? 'active' : ''} onClick={() => setTab('quiz')}>
                Quiz ({l.quiz.questionCount} câu)
              </a>
            )}
          </nav>

          {tab === 'content' && (
            <>
              {l.videoUrl && <Video url={l.videoUrl} />}
              <Html html={l.content} />
              {l.attachments.length > 0 && (
                <div>
                  <h3 style={{ fontSize: 18, marginBottom: 12 }}>Tài liệu đính kèm</h3>
                  <div className="grid-2" style={{ gap: 12 }}>
                    {l.attachments.map((a) => (
                      <a key={a.id} className="att" href={a.url} target="_blank" rel="noreferrer" download>
                        <span className="ic">
                          <Icon name="file" />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="bold small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                          <div className="xs muted">{fileSize(a.sizeBytes)}</div>
                        </div>
                        <Icon name="download" style={{ marginLeft: 'auto', color: 'var(--red)' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {tab === 'assignment' && (
            <>
              <div className="alert info">
                <Icon name="info" />
                <span>Đề bài để bạn tự thực hành, không cần nộp. Hãy làm thử trước khi làm quiz.</span>
              </div>
              <Html html={l.assignment} />
            </>
          )}
          {tab === 'quiz' && l.quiz && <QuizIntro lesson={l} slug={slug} enrollmentExpiresAt={e.status === 'IN_PROGRESS' ? e.expiresAt : undefined} />}

          <div className="navbtns">
            {l.previousLessonId ? (
              <button className="btn btn-light btn-lg" onClick={() => nav(`/hoc/${slug}/bai/${l.previousLessonId}`)}>
                <Icon name="chevron-left" />
                Bài trước
              </button>
            ) : (
              <span />
            )}
            {canMark ? (
              <button className="btn btn-primary btn-lg" disabled={!viewedEnough || complete.isPending} onClick={() => complete.mutate()} title={viewedEnough ? '' : 'Hãy xem nội dung ít nhất 30 giây'}>
                <Icon name="check" />
                {viewedEnough ? 'Đánh dấu đã học xong' : 'Đánh dấu đã học xong (sau 30 giây)'}
              </button>
            ) : l.quiz && tab !== 'quiz' && !l.quiz.passed ? (
              <button className="btn btn-primary btn-lg" onClick={() => setTab('quiz')}>
                Làm quiz
                <Icon name="chevron-right" />
              </button>
            ) : l.nextLessonId ? (
              <button className="btn btn-primary btn-lg" onClick={() => nav(`/hoc/${slug}/bai/${l.nextLessonId}`)}>
                Bài tiếp theo
                <Icon name="chevron-right" />
              </button>
            ) : e.status === 'COMPLETED' ? (
              <Link className="btn btn-primary btn-lg" to={`/hoc/${slug}/hoan-thanh`}>
                <Icon name="award" />
                Xem kết quả khóa học
              </Link>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function Video({ url }: { url: string }) {
  const embed = useMemo(() => {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return null;
  }, [url]);
  return (
    <div className="video-frame">
      {embed ? (
        <iframe src={embed} title="Video bài học" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <video src={url} controls preload="metadata" />
      )}
    </div>
  );
}

// ====================================================================== SCR-LRN-02 Giới thiệu quiz

function QuizIntro({ lesson, slug, enrollmentExpiresAt }: { lesson: LessonContent; slug: string; enrollmentExpiresAt?: string }) {
  const quiz = lesson.quiz!;
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const history = useQuery({ queryKey: ['history', quiz.id], queryFn: () => api<AttemptHistoryItem[]>(`/learning/quizzes/${quiz.id}/attempts`) });
  const start = useMutation({
    mutationFn: () => api<{ attemptId: number }>(`/learning/quizzes/${quiz.id}/attempts`, { method: 'POST' }),
    onSuccess: (r) => nav(`/hoc/${slug}/quiz/${r.attemptId}`),
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const begin = async () => {
    if (quiz.inProgressAttemptId) return nav(`/hoc/${slug}/quiz/${quiz.inProgressAttemptId}`);
    // FR-LRN-12: cảnh báo khi thời gian làm bài vượt quá hạn học còn lại.
    if (enrollmentExpiresAt && quiz.timeLimitSeconds) {
      const leftSec = (new Date(enrollmentExpiresAt).getTime() - Date.now()) / 1000;
      if (leftSec < quiz.timeLimitSeconds) {
        const r = await confirm({
          title: 'Sắp hết thời hạn học',
          reference: 'FR-LRN-12',
          tone: 'warn',
          icon: 'hourglass',
          confirmText: 'Vẫn bắt đầu',
          cancelText: 'Để sau',
          body: `Quiz có thời gian làm ${Math.round(quiz.timeLimitSeconds / 60)} phút, nhưng thời hạn học của bạn chỉ còn ${remaining(enrollmentExpiresAt)}. Nếu chưa nộp trước ${formatDateTime(enrollmentExpiresAt)}, lượt làm sẽ bị hủy và không được chấm.`,
        });
        if (!r.ok) return;
      }
    }
    start.mutate();
  };
  const exhausted = quiz.maxAttempts !== undefined && quiz.maxAttempts !== null && quiz.usedAttempts >= quiz.maxAttempts;
  const cooling = quiz.nextAttemptAt && new Date(quiz.nextAttemptAt).getTime() > Date.now();
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="panel intro">
        <div className="top">
          <span className="avatar" style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,255,255,.15)', color: '#fff' }}>
            <Icon name="target" size="lg" />
          </span>
          <div>
            <div className="small" style={{ opacity: 0.85 }}>Quiz cuối bài {lesson.orderIndex}</div>
            <h2 style={{ fontSize: 24, fontWeight: 800 }}>{quiz.title}</h2>
          </div>
        </div>
        <div className="facts4">
          <div>
            <b>{quiz.questionCount}</b>
            <span>
              <Icon name="list" size="sm" />
              Câu hỏi
            </span>
          </div>
          <div>
            <b>{quiz.timeLimitSeconds ? `${Math.round(quiz.timeLimitSeconds / 60)} phút` : 'Không giới hạn'}</b>
            <span>
              <Icon name="clock" size="sm" />
              Thời gian làm bài
            </span>
          </div>
          <div>
            <b>{quiz.passScorePercent}%</b>
            <span>
              <Icon name="target" size="sm" />
              Điểm đạt
            </span>
          </div>
          <div>
            <b>{quiz.maxAttempts ? `${Math.max(0, quiz.maxAttempts - quiz.usedAttempts)} / ${quiz.maxAttempts}` : 'Không giới hạn'}</b>
            <span>
              <Icon name="refresh" size="sm" />
              {quiz.maxAttempts ? 'Lượt còn lại' : 'Số lần làm'}
            </span>
          </div>
        </div>
        <div className="panel-b stack" style={{ gap: 10 }}>
          <b>Lưu ý trước khi làm bài</b>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {quiz.timeLimitSeconds && <li>Đồng hồ bắt đầu chạy khi bạn bấm "Bắt đầu làm bài" và không dừng khi rời trang. Hết giờ, hệ thống tự nộp các câu bạn đã trả lời.</li>}
            <li>Câu nhiều đáp án chỉ được điểm khi chọn đúng và đủ.</li>
            <li>Đạt từ {quiz.passScorePercent}% trở lên để hoàn thành bài này. Bảng xếp hạng tính lượt có điểm cao nhất.</li>
          </ul>
          {quiz.passed && (
            <div className="alert success" style={{ fontSize: 14 }}>
              <Icon name="check-circle" size="sm" />
              Bạn đã đạt quiz này (cao nhất {formatNumber(quiz.bestScorePercent)}%). Bạn vẫn có thể làm lại để cải thiện điểm xếp hạng.
            </div>
          )}
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" disabled={start.isPending || (!quiz.inProgressAttemptId && (exhausted || !!cooling))} onClick={begin}>
              <Icon name="play" />
              {quiz.inProgressAttemptId ? 'Tiếp tục lượt đang làm' : quiz.usedAttempts > 0 ? 'Làm lại' : 'Bắt đầu làm bài'}
            </button>
            {exhausted && <span className="small" style={{ color: 'var(--error)' }}>Bạn đã dùng hết số lần làm bài.</span>}
            {cooling && !exhausted && <span className="small muted">Bạn có thể làm lại sau {formatDateTime(quiz.nextAttemptAt)}.</span>}
            {!exhausted && !cooling && quiz.usedAttempts > 0 && <span className="small muted">Lượt làm thứ {quiz.usedAttempts + 1}</span>}
          </div>
        </div>
      </div>
      {history.data && history.data.length > 0 && (
        <div className="panel table-wrap">
          <div className="panel-h">
            <h3>Lịch sử làm bài</h3>
            <span className="small muted">Lượt tốt nhất được dùng để xếp hạng</span>
          </div>
          <table className="table compact">
            <thead>
              <tr>
                <th>Lượt</th>
                <th>Thời điểm</th>
                <th>Điểm</th>
                <th>Thời gian</th>
                <th>Kết quả</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.data.map((h) => (
                <tr key={h.id}>
                  <td className="bold">
                    {h.attemptNo}
                    {h.best && <span className="chip gold" style={{ marginLeft: 6 }}>Tốt nhất</span>}
                  </td>
                  <td>{formatDateTime(h.submittedAt ?? h.startedAt)}</td>
                  <td className="bold">{h.status === 'IN_PROGRESS' ? '—' : `${formatNumber(h.score)} / ${formatNumber(h.maxScore)} (${formatNumber(h.scorePercent)}%)`}</td>
                  <td>{h.durationSeconds !== undefined && h.durationSeconds !== null ? formatClock(h.durationSeconds) : '—'}</td>
                  <td>
                    {h.status === 'IN_PROGRESS' ? <span className="chip neutral">Đang làm</span> : h.passed ? <span className="chip success">Đạt</span> : <span className="chip error">Chưa đạt</span>}
                  </td>
                  <td>
                    {h.status !== 'IN_PROGRESS' && (
                      <Link className="small bold" to={`/hoc/${slug}/quiz/${h.id}/ket-qua`}>
                        Xem lại
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ====================================================================== SCR-LRN-03 Làm quiz

const KEYS = 'ABCDEFGH';

export function QuizAttemptPage() {
  const { slug = '', attemptId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const draftKey = `quiz-draft-${attemptId}`;
  const q = useQuery({ queryKey: ['attempt', attemptId], queryFn: () => api<AttemptView>(`/learning/attempts/${attemptId}`), retry: false });
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const loaded = useRef(false);
  const left = useCountdown(q.data?.expiresAt ? new Date(new Date(q.data.expiresAt).getTime() - 30_000).toISOString() : null);

  // Khôi phục đáp án: ưu tiên bản nháp đã lưu ở máy chủ, sau đó là bản nháp trong trình duyệt (FR-LRN-04 bước 7).
  useEffect(() => {
    if (!q.data || loaded.current) return;
    loaded.current = true;
    const fromServer: Record<number, number[]> = {};
    q.data.savedAnswers.forEach((a) => (fromServer[a.questionId] = a.selectedOptionIds));
    let local: Record<number, number[]> = {};
    try {
      local = JSON.parse(localStorage.getItem(draftKey) ?? '{}');
    } catch {
      local = {};
    }
    setAnswers({ ...fromServer, ...local });
  }, [q.data, draftKey]);

  const payload = useCallback((): AnswerInput[] => Object.entries(answers).map(([k, v]) => ({ questionId: Number(k), selectedOptionIds: v })), [answers]);

  // Lưu nháp: trình duyệt ngay lập tức, máy chủ mỗi 15 giây.
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(answers));
    } catch {
      /* bộ nhớ trình duyệt bị chặn */
    }
    dirty.current = true;
  }, [answers, draftKey]);
  useEffect(() => {
    const t = setInterval(() => {
      if (!dirty.current || submitting) return;
      dirty.current = false;
      api(`/learning/attempts/${attemptId}/answers`, { method: 'PUT', body: { answers: payload() } }).catch(() => {
        dirty.current = true;
      });
    }, 15_000);
    return () => clearInterval(t);
  }, [attemptId, payload, submitting]);

  const submit = useCallback(
    async (auto = false) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const r = await api<SubmitResult>(`/learning/attempts/${attemptId}/submit`, { method: 'POST', body: { answers: payload() } });
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* bỏ qua */
        }
        qc.invalidateQueries({ queryKey: ['learn', slug] });
        qc.invalidateQueries({ queryKey: ['lesson'] });
        qc.invalidateQueries({ queryKey: ['history'] });
        if (auto) toast('Hết giờ — bài làm đã được tự động nộp', 'info');
        nav(`/hoc/${slug}/quiz/${r.attemptId}/ket-qua`, { replace: true, state: { submit: r } });
      } catch (e) {
        setSubmitting(false);
        if (e instanceof ApiError && e.code === 'ATTEMPT_SUBMITTED') nav(`/hoc/${slug}/quiz/${attemptId}/ket-qua`, { replace: true });
        else if (e instanceof ApiError && e.code === 'ENROLLMENT_EXPIRED') nav(`/hoc/${slug}`, { replace: true });
        else toast(errorMessage(e), 'error');
      }
    },
    [attemptId, draftKey, nav, payload, qc, slug, submitting, toast],
  );

  useEffect(() => {
    if (left === 0 && q.data?.expiresAt) submit(true);
  }, [left, q.data?.expiresAt, submit]);

  if (q.error) {
    if (q.error instanceof ApiError && q.error.code === 'ATTEMPT_SUBMITTED') return <Navigate to={`/hoc/${slug}/quiz/${attemptId}/ket-qua`} replace />;
    return <AccessError error={q.error} slug={slug} />;
  }
  if (q.isLoading) return <Spinner />;
  const a = q.data!;
  const question = a.questions[idx];
  const answered = a.questions.filter((x) => (answers[x.id]?.length ?? 0) > 0).length;
  const choose = (optId: number) => {
    const cur = answers[question.id] ?? [];
    const next = question.type === 'MULTIPLE_CHOICE' ? (cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId]) : [optId];
    setAnswers({ ...answers, [question.id]: next });
  };
  const askSubmit = async () => {
    const missing = a.questions.map((x, i) => ((answers[x.id]?.length ?? 0) === 0 ? i + 1 : 0)).filter(Boolean);
    if (missing.length) {
      const r = await confirm({
        title: `Còn ${missing.length} câu chưa trả lời`,
        reference: 'FR-LRN-04',
        tone: 'warn',
        icon: 'list',
        confirmText: 'Nộp bài',
        cancelText: 'Quay lại làm tiếp',
        body: `Câu ${missing.join(', ')} chưa có đáp án. Câu bỏ trống được tính 0 điểm. Bạn vẫn muốn nộp bài?`,
      });
      if (!r.ok) return;
    }
    submit();
  };
  const typeLabel = { SINGLE_CHOICE: 'Chọn 1 đáp án', MULTIPLE_CHOICE: 'Chọn nhiều đáp án', TRUE_FALSE: 'Đúng / Sai' }[question.type];

  return (
    <div className="learn">
      <div className="qbar">
        <img src="/logo-256.png" alt="" />
        <div style={{ minWidth: 0 }}>
          <div className="bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.quizTitle}</div>
          <div className="xs muted">
            Lượt làm thứ {a.attemptNo} · Điểm đạt {a.passScorePercent}%
          </div>
        </div>
        <span style={{ flex: 1 }} />
        {left !== null && (
          <div className={`timer${left < 60 ? ' low' : ''}`} aria-live="off" aria-label="Thời gian còn lại">
            <Icon name="clock" />
            {formatClock(left)}
          </div>
        )}
        <button className="btn btn-primary" onClick={askSubmit} disabled={submitting}>
          Nộp bài
        </button>
      </div>
      <div className="qgrid">
        <div className="stack" style={{ gap: 20 }}>
          <div className="qcard">
            <div className="row-between">
              <span className="chip">
                Câu {idx + 1} / {a.questions.length}
              </span>
              <span className="chip neutral">
                {typeLabel} · {formatNumber(question.points)} điểm
              </span>
            </div>
            <Html html={question.content} className="q prose-html" />
            <div className="stack" role={question.type === 'MULTIPLE_CHOICE' ? 'group' : 'radiogroup'}>
              {question.options.map((o, i) => {
                const on = (answers[question.id] ?? []).includes(o.id);
                return (
                  <button key={o.id} className={`qopt${on ? ' on' : ''}`} onClick={() => choose(o.id)} role={question.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'} aria-checked={on}>
                    <span className="key">{KEYS[i]}</span>
                    {o.content}
                  </button>
                );
              })}
            </div>
            <div className="row-between" style={{ marginTop: 8 }}>
              <button className="btn btn-light btn-lg" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
                <Icon name="chevron-left" />
                Câu trước
              </button>
              {idx < a.questions.length - 1 ? (
                <button className="btn btn-outline btn-lg" onClick={() => setIdx(idx + 1)}>
                  Câu tiếp theo
                  <Icon name="chevron-right" />
                </button>
              ) : (
                <button className="btn btn-primary btn-lg" onClick={askSubmit} disabled={submitting}>
                  Nộp bài
                </button>
              )}
            </div>
          </div>
          <div className="alert info">
            <Icon name="info" />
            <span>Đáp án được tự động lưu. Nếu lỡ tải lại trang, bạn vẫn tiếp tục được lượt làm này khi chưa hết giờ.</span>
          </div>
        </div>
        <aside className="navq">
          <div className="row-between">
            <b>Danh sách câu hỏi</b>
            <span className="small muted">
              {answered}/{a.questions.length} đã trả lời
            </span>
          </div>
          <div className="qn">
            {a.questions.map((x, i) => (
              <button key={x.id} className={`${(answers[x.id]?.length ?? 0) > 0 ? 'a' : ''}${i === idx ? ' c' : ''}`} onClick={() => setIdx(i)} aria-label={`Câu ${i + 1}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="stack small muted" style={{ gap: 6 }}>
            <span className="row">
              <i style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--red)', display: 'inline-block' }} />
              Đã trả lời
            </span>
            <span className="row">
              <i style={{ width: 18, height: 18, borderRadius: 5, border: '2px solid var(--line-2)', display: 'inline-block' }} />
              Chưa trả lời
            </span>
          </div>
          {deadlineLevel(a.enrollmentExpiresAt) !== 'ok' && (
            <div className="alert warn" style={{ fontSize: 14 }}>
              <Icon name="hourglass" size="sm" />
              <span>Hạn học của bạn còn {remaining(a.enrollmentExpiresAt)}.</span>
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={askSubmit} disabled={submitting}>
            Nộp bài
          </button>
        </aside>
      </div>
    </div>
  );
}

// ====================================================================== SCR-LRN-04 Kết quả

export function QuizResultPage() {
  const { slug = '', attemptId = '' } = useParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['result', attemptId], queryFn: () => api<AttemptResult>(`/learning/attempts/${attemptId}/result`), retry: false });
  const overview = useQuery({ queryKey: ['learn', slug], queryFn: () => api<CourseOverview>(`/learning/courses/${slug}`), retry: false });
  if (q.error) return <AccessError error={q.error} slug={slug} />;
  if (q.isLoading) return <Spinner />;
  const r = q.data!;
  const pct = Number(r.scorePercent);
  const color = r.passed ? 'var(--success)' : 'var(--error)';
  const courseDone = overview.data?.enrollment.status === 'COMPLETED' && overview.data.enrollment.progressPercent === 100;
  const correct = r.questions.filter((x) => x.isCorrect).length;
  return (
    <div className="learn">
      <LearnBar title={overview.data?.title ?? 'Kết quả quiz'} slug={slug} />
      <div className="container stack" style={{ maxWidth: 960, gap: 24, padding: '32px 20px 48px' }}>
        <div className="crumb">
          <Link to={`/hoc/${slug}/bai/${r.lessonId}`} style={{ color: 'inherit' }}>
            {r.lessonTitle}
          </Link>
          <Icon name="chevron-right" size="sm" />
          <b>Kết quả quiz · lượt {r.attemptNo}</b>
        </div>
        <div className="score-box">
          <div className="score-ring" style={{ background: `conic-gradient(${color} 0 ${pct}%, var(--line) ${pct}% 100%)` }}>
            <div className="inn">
              <div className="v">{formatNumber(Math.round(pct))}%</div>
              <div className="small muted">
                {formatNumber(r.score)} / {formatNumber(r.maxScore)} điểm
              </div>
            </div>
          </div>
          <div>
            <span className={`chip ${r.passed ? 'success' : 'error'}`}>
              <Icon name={r.passed ? 'check-circle' : 'x'} size="sm" />
              {r.passed ? 'Đạt' : 'Chưa đạt'} — yêu cầu {r.passScorePercent}%
            </span>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 14 }}>{r.passed ? 'Chúc mừng, bạn đã qua bài này!' : 'Chưa đạt, hãy ôn lại và thử lần nữa'}</h1>
            {r.status === 'EXPIRED' && <p className="small muted" style={{ marginTop: 4 }}>Lượt này được tự động nộp khi hết giờ.</p>}
            <div className="kv">
              <div>
                <b>
                  {correct}/{r.questions.length}
                </b>
                <span>Câu đúng</span>
              </div>
              <div>
                <b>{formatClock(r.durationSeconds)}</b>
                <span>Thời gian làm</span>
              </div>
              <div>
                <b>{r.isBest ? 'Có' : 'Không'}</b>
                <span>Lượt tốt nhất</span>
              </div>
              <div>
                <b>{r.rank ? `#${r.rank}` : '—'}</b>
                <span>Hạng hiện tại</span>
              </div>
            </div>
          </div>
        </div>

        {courseDone ? (
          <div className="unlock">
            <span className="ic">
              <Icon name="award" size="lg" />
            </span>
            <div style={{ flex: 1 }}>
              <div className="small" style={{ opacity: 0.85 }}>Bạn đã hoàn thành toàn bộ khóa học</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{overview.data?.title}</div>
            </div>
            <Link className="btn btn-white btn-lg" to={`/hoc/${slug}/hoan-thanh`}>
              Xem kết quả khóa học
            </Link>
          </div>
        ) : r.passed && r.nextLesson ? (
          <div className="unlock">
            <span className="ic">
              <Icon name="lock" size="lg" />
            </span>
            <div style={{ flex: 1 }}>
              <div className="small" style={{ opacity: 0.85 }}>Đã mở khóa bài tiếp theo</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{r.nextLesson.title}</div>
              <div className="small" style={{ opacity: 0.85, marginTop: 2 }}>
                Tiến độ khóa học: {r.courseProgressPercent}%
                {overview.data?.enrollment.status === 'IN_PROGRESS' ? ` · Hạn học còn ${remaining(overview.data.enrollment.expiresAt)}` : ''}
              </div>
            </div>
            <button className="btn btn-white btn-lg" onClick={() => nav(`/hoc/${slug}/bai/${r.nextLesson!.id}`)}>
              Học bài tiếp theo
              <Icon name="chevron-right" />
            </button>
          </div>
        ) : !r.passed ? (
          <div className="alert warn">
            <Icon name="info" />
            <span>Hãy xem lại nội dung bài học rồi làm lại quiz. Bạn được làm lại để đạt yêu cầu.</span>
            <Link className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }} to={`/hoc/${slug}/bai/${r.lessonId}`}>
              Ôn lại bài
            </Link>
          </div>
        ) : null}

        <div className="row-between">
          <h2 style={{ fontSize: 22 }}>{r.showAnswers ? 'Xem lại đáp án' : 'Câu trả lời của bạn'}</h2>
          <Link className="btn btn-light btn-sm" to={`/hoc/${slug}/bai/${r.lessonId}`}>
            <Icon name="refresh" size="sm" />
            {r.passed ? 'Làm lại để cải thiện điểm' : 'Làm lại'}
          </Link>
        </div>
        {r.questions.map((x, i) => {
          const chosen = x.options.filter((o) => o.selected).map((o) => o.content);
          const right = x.options.filter((o) => o.correct).map((o) => o.content);
          return (
            <div key={x.id} className="qa">
              <div className="h">
                <Icon name={x.isCorrect ? 'check-circle' : 'x'} style={{ color: x.isCorrect ? 'var(--success)' : 'var(--error)', flex: 'none', marginTop: 2 }} />
                <span>
                  Câu {i + 1}. <Html html={x.content} className="" />
                </span>
              </div>
              <div className={`a ${x.isCorrect ? 'ok' : r.showAnswers ? 'bad' : 'plain'}`}>
                <Icon name={x.isCorrect ? 'check' : 'x'} size="sm" />
                Bạn chọn: {chosen.length ? chosen.join('; ') : '(bỏ trống)'} — {x.isCorrect ? 'Đúng' : 'Sai'}
              </div>
              {r.showAnswers && !x.isCorrect && (
                <div className="a ok">
                  <Icon name="check" size="sm" />
                  Đáp án đúng: {right.join('; ')}
                </div>
              )}
              {x.explanation && (
                <div className="ex">
                  <b>Giải thích:</b> <Html html={x.explanation} className="" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ====================================================================== SCR-LRN-05 Hoàn thành khóa học

export function CourseCompletedPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const o = useQuery({ queryKey: ['learn', slug], queryFn: () => api<CourseOverview>(`/learning/courses/${slug}`), retry: false });
  const rank = useQuery({ queryKey: ['ranking-me', slug, user?.id], queryFn: () => api<{ rank?: number; totalRanked: number; totalScore?: number }>(`/courses/${slug}/ranking/me`) });
  const more = useQuery({ queryKey: ['courses', 'more'], queryFn: () => api<Page<Card>>('/courses?sort=popular&size=8') });
  if (o.error) return <AccessError error={o.error} slug={slug} />;
  if (o.isLoading) return <Spinner />;
  const c = o.data!;
  if (c.enrollment.status !== 'COMPLETED') return <Navigate to={`/hoc/${slug}`} replace />;
  const scores = c.lessons.map((l) => l.bestScorePercent).filter((x): x is number => x !== undefined && x !== null);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const early = Math.floor((new Date(c.enrollment.expiresAt).getTime() - new Date(c.enrollment.completedAt ?? Date.now()).getTime()) / 86_400_000);
  return (
    <>
      <section className="celebrate">
        <div className="dots" />
        <div className="container">
          <span className="badge-c">
            <Icon name="award" />
          </span>
          <span className="chip" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}>
            Hoàn thành ngày {formatDate(c.enrollment.completedAt)}
            {early > 0 ? ` · trước hạn ${early} ngày` : ''}
          </span>
          <h1 style={{ fontSize: 40, fontWeight: 800 }}>Chúc mừng {user?.fullName}!</h1>
          <p style={{ fontSize: 18, opacity: 0.92, maxWidth: 640 }}>
            Bạn đã hoàn thành khóa học <b>"{c.title}"</b>. Kết quả và thứ hạng của bạn được lưu lại vĩnh viễn.
          </p>
        </div>
      </section>
      <div className="container" style={{ paddingBottom: 32 }}>
        <div className="sum4">
          <div>
            <b>
              {c.lessons.filter((l) => l.state === 'COMPLETED').length} / {c.lessons.length}
            </b>
            <span>Bài học hoàn thành</span>
          </div>
          <div>
            <b>{avg !== null ? `${avg}%` : '—'}</b>
            <span>Điểm quiz trung bình</span>
          </div>
          <div>
            <b>{rank.data?.totalScore !== undefined && rank.data?.totalScore !== null ? `${formatNumber(rank.data.totalScore)} điểm` : '—'}</b>
            <span>Tổng điểm xếp hạng</span>
          </div>
          <div>
            <b>{rank.data?.rank ? `#${rank.data.rank}` : '—'}</b>
            <span>Hạng / {formatNumber(rank.data?.totalRanked)} người học</span>
          </div>
        </div>
        <div className="row" style={{ gap: 12, marginTop: 28, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={() => nav(`/khoa-hoc/${slug}?tab=danh-gia`)}>
            <Icon name="star" />
            Đánh giá khóa học
          </button>
          <button className="btn btn-light btn-lg" onClick={() => nav(`/hoc/${slug}/bai/${c.lessons[0]?.id}`)}>
            <Icon name="book" />
            Xem lại khóa học
          </button>
          <Link className="btn btn-outline btn-lg" to={`/khoa-hoc/${slug}?tab=xep-hang`}>
            <Icon name="trophy" />
            Xem bảng xếp hạng
          </Link>
        </div>
        <div className="panel" style={{ marginTop: 28 }}>
          <div className="panel-h">
            <h3>Chứng nhận hoàn thành</h3>
            <span className="chip gold">Sắp ra mắt</span>
          </div>
          <div className="panel-b small muted">Chứng nhận PDF có mã xác minh sẽ được cấp ở giai đoạn sau cho người học đủ điều kiện.</div>
        </div>
        <div className="sec-title" style={{ marginTop: 56 }}>
          <h2>Học tiếp khóa học khác</h2>
          <Link to="/khoa-hoc">
            Xem tất cả
            <Icon name="chevron-right" size="sm" />
          </Link>
        </div>
        <div className="grid-4">
          {(more.data?.items ?? [])
            .filter((x) => x.slug !== slug && !x.myEnrollment)
            .slice(0, 4)
            .map((x) => (
              <CourseCard key={x.id} c={x} />
            ))}
        </div>
      </div>
    </>
  );
}
