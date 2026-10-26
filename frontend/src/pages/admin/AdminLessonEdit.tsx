import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/api/client';
import { Icon } from '@/components/Icon';
import { RichEditor, uploadFile } from '@/components/RichEditor';
import { ErrorBox, Field, Spinner, Toggle, errorMessage, useConfirm, useToast } from '@/components/ui';
import { fileSize, formatNumber } from '@/lib/format';
import { AdminPage } from './AdminLayout';

interface Attachment {
  fileId: number;
  displayName: string;
  url: string;
  contentType: string;
  sizeBytes: number;
}
interface OptionForm {
  id?: number;
  content: string;
  isCorrect: boolean;
}
interface QuestionForm {
  id: number;
  content: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  points: number;
  explanation?: string;
  orderIndex: number;
  answerCount: number;
  options: OptionForm[];
}
interface QuizForm {
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
  questions: QuestionForm[];
}
interface LessonForm {
  id: number;
  courseId: number;
  orderIndex: number;
  title: string;
  content?: string;
  videoUrl?: string;
  assignment?: string;
  estimatedMinutes?: number;
  isPublished: boolean;
  attachments: Attachment[];
  quiz?: QuizForm;
  openedCount: number;
  completedCount: number;
}
interface LessonRow {
  id: number;
  orderIndex: number;
  title: string;
  isPublished: boolean;
}

const TYPE_LABEL = { SINGLE_CHOICE: 'Một đáp án', MULTIPLE_CHOICE: 'Nhiều đáp án', TRUE_FALSE: 'Đúng/Sai' };

/** SCR-ADM-07 — FR-ADM-16, FR-ADM-17. */
export default function AdminLessonEdit() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'content' | 'assignment' | 'files' | 'quiz'>('content');
  const q = useQuery({ queryKey: ['admin', 'lesson', id], queryFn: () => api<LessonForm>(`/admin/lessons/${id}`) });
  const course = useQuery({
    queryKey: ['admin', 'course', String(q.data?.courseId)],
    queryFn: () => api<{ id: number; title: string; enrollmentCount: number }>(`/admin/courses/${q.data!.courseId}`),
    enabled: !!q.data,
  });
  const lessons = useQuery({ queryKey: ['admin', 'lessons', q.data?.courseId], queryFn: () => api<LessonRow[]>(`/admin/courses/${q.data!.courseId}/lessons`), enabled: !!q.data });
  const [f, setF] = useState({ title: '', content: '', videoUrl: '', assignment: '', estimatedMinutes: '', isPublished: false, attachments: [] as Attachment[] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data)
      setF({
        title: q.data.title,
        content: q.data.content ?? '',
        videoUrl: q.data.videoUrl ?? '',
        assignment: q.data.assignment ?? '',
        estimatedMinutes: q.data.estimatedMinutes ? String(q.data.estimatedMinutes) : '',
        isPublished: q.data.isPublished,
        attachments: q.data.attachments,
      });
  }, [q.data]);
  useEffect(() => {
    setTab('content');
  }, [id]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'lesson', id] });
    qc.invalidateQueries({ queryKey: ['admin', 'lessons'] });
  };
  const save = useMutation({
    mutationFn: () =>
      api(`/admin/lessons/${id}`, {
        method: 'PUT',
        body: {
          ...f,
          estimatedMinutes: f.estimatedMinutes ? Number(f.estimatedMinutes) : null,
          attachments: f.attachments.map((a) => ({ fileId: a.fileId, displayName: a.displayName })),
        },
      }),
    onSuccess: () => {
      setErrors({});
      toast('Đã lưu bài học');
      refresh();
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast(errorMessage(e), 'error');
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/admin/lessons/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Đã xóa bài học', 'info');
      qc.invalidateQueries({ queryKey: ['admin', 'lessons'] });
      nav(`/admin/khoa-hoc/${q.data!.courseId}?tab=bai-hoc`);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const addLesson = useMutation({
    mutationFn: () => api<{ id: number }>(`/admin/courses/${q.data!.courseId}/lessons`, { method: 'POST', body: { title: 'Bài học mới', isPublished: false } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin', 'lessons'] });
      nav(`/admin/bai-hoc/${r.id}`);
    },
  });

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const l = q.data!;

  return (
    <AdminPage
      crumbs={[
        ['Khóa học', '/admin/khoa-hoc'],
        [course.data?.title ?? '...', `/admin/khoa-hoc/${l.courseId}?tab=bai-hoc`],
        [`Bài ${l.orderIndex}`],
      ]}
      title={
        <span className="stack" style={{ gap: 8 }}>
          Bài {l.orderIndex}. {l.title}
          <span className="row" style={{ gap: 8, fontSize: 14, fontWeight: 500 }}>
            {l.isPublished ? <span className="chip success">Đã xuất bản</span> : <span className="chip neutral">Nháp / ẩn</span>}
            <span className="small muted">
              {formatNumber(l.openedCount)} người đã mở bài · {formatNumber(l.completedCount)} người đã hoàn thành
            </span>
          </span>
        </span>
      }
      actions={
        <>
          <button
            className="btn btn-light"
            style={{ color: 'var(--error)' }}
            onClick={async () =>
              (await confirm({ title: 'Xóa bài học này?', body: l.openedCount > 0 ? 'Bài đã có người học nên chỉ có thể ẩn (bỏ xuất bản), không xóa được.' : 'Bài học, quiz và câu hỏi sẽ bị xóa.', confirmText: 'Xóa', danger: true, icon: 'trash' })).ok &&
              remove.mutate()
            }
          >
            <Icon name="trash" />
            Xóa
          </button>
          <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
            <Icon name="check" />
            Lưu
          </button>
        </>
      }
    >
      <div className="split" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-h">
            <h3>Bài học ({lessons.data?.length ?? 0})</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => addLesson.mutate()}>
              <Icon name="plus" size="sm" />
              Thêm
            </button>
          </div>
          {lessons.data?.map((x) => (
            <div key={x.id} className={`les-row${String(x.id) === id ? ' sel' : ''}`} onClick={() => nav(`/admin/bai-hoc/${x.id}`)}>
              <span className="n">{x.orderIndex}</span>
              <span style={{ flex: 1 }}>{x.title}</span>
              {x.isPublished ? <Icon name="check-circle" size="sm" style={{ color: 'var(--success)' }} /> : <span className="chip neutral">Nháp</span>}
            </div>
          ))}
          {(course.data?.enrollmentCount ?? 0) > 0 && (
            <div className="panel-b">
              <div className="alert warn" style={{ fontSize: 13 }}>
                <Icon name="alert" size="sm" />
                <span>Khóa học đã có học viên. Sắp xếp lại hoặc chèn bài mới sẽ ảnh hưởng thứ tự mở khóa.</span>
              </div>
            </div>
          )}
          <div className="panel-b">
            <Link className="small bold" to={`/admin/khoa-hoc/${l.courseId}?tab=bai-hoc`}>
              Sắp xếp thứ tự bài học
            </Link>
          </div>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <nav className="tabs">
            <a className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}>
              Nội dung bài học
            </a>
            <a className={tab === 'assignment' ? 'active' : ''} onClick={() => setTab('assignment')}>
              Đề bài
            </a>
            <a className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>
              Tệp đính kèm ({f.attachments.length})
            </a>
            <a className={tab === 'quiz' ? 'active' : ''} onClick={() => setTab('quiz')}>
              Quiz {l.quiz ? `(${l.quiz.questions.length} câu)` : ''}
            </a>
          </nav>

          {tab === 'content' && (
            <div className="panel">
              <div className="panel-b stack" style={{ gap: 18 }}>
                <div className="fgrid">
                  <Field label="Tên bài" required error={errors.title} className="full">
                    <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} />
                  </Field>
                  <Field label="Video (YouTube/Vimeo hoặc https://...mp4)" error={errors.videoUrl}>
                    <input className="input" value={f.videoUrl} onChange={(e) => setF({ ...f, videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
                  </Field>
                  <Field label="Thời lượng ước tính (phút)">
                    <input className="input" type="number" min={0} value={f.estimatedMinutes} onChange={(e) => setF({ ...f, estimatedMinutes: e.target.value })} />
                  </Field>
                </div>
                <Field label="Nội dung lý thuyết">
                  <RichEditor value={f.content} onChange={(v) => setF((x) => ({ ...x, content: v }))} />
                </Field>
                <div className="row-between">
                  <div>
                    <div className="bold small">Xuất bản bài học</div>
                    <div className="xs muted">Bài chưa xuất bản không hiển thị với người học và không tính vào tiến độ.</div>
                  </div>
                  <Toggle on={f.isPublished} label="Xuất bản bài học" onChange={(v) => setF({ ...f, isPublished: v })} />
                </div>
              </div>
            </div>
          )}
          {tab === 'assignment' && (
            <div className="panel">
              <div className="panel-b stack">
                <span className="small muted">Đề bài là phần thực hành để người học tự làm trước khi làm quiz (không cần nộp bài — Q-07).</span>
                <RichEditor value={f.assignment} onChange={(v) => setF((x) => ({ ...x, assignment: v }))} />
              </div>
            </div>
          )}
          {tab === 'files' && (
            <div className="panel">
              <div className="panel-b stack">
                {f.attachments.map((a, i) => (
                  <div key={a.fileId} className="att">
                    <span className="ic">
                      <Icon name="file" />
                    </span>
                    <input className="input" style={{ height: 40, flex: 1 }} value={a.displayName} onChange={(e) => setF({ ...f, attachments: f.attachments.map((x, j) => (j === i ? { ...x, displayName: e.target.value } : x)) })} aria-label="Tên hiển thị" />
                    <span className="xs muted">{fileSize(a.sizeBytes)}</span>
                    <button className="icon-btn" aria-label="Gỡ tệp" onClick={() => setF({ ...f, attachments: f.attachments.filter((_, j) => j !== i) })}>
                      <Icon name="x" size="sm" />
                    </button>
                  </div>
                ))}
                <label className="btn btn-light" style={{ alignSelf: 'flex-start' }}>
                  <Icon name="upload" size="sm" />
                  Tải tệp lên (PDF, DOCX, XLSX, PPTX ≤ 20MB)
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.docx,.xlsx,.pptx,image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const r = await uploadFile(file, 'LESSON_ATTACHMENT');
                        setF((x) => ({ ...x, attachments: [...x.attachments, { fileId: r.id, displayName: r.originalName, url: r.url, contentType: r.contentType, sizeBytes: r.sizeBytes }] }));
                        toast('Đã tải tệp. Bấm "Lưu" để gắn vào bài học.', 'info');
                      } catch (err) {
                        toast(errorMessage(err), 'error');
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}
          {tab === 'quiz' && <QuizBuilder lessonId={l.id} quiz={l.quiz} onChange={refresh} />}
        </div>
      </div>
    </AdminPage>
  );
}

// ============================================================================ quiz builder

function QuizBuilder({ lessonId, quiz, onChange }: { lessonId: number; quiz?: QuizForm; onChange: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [cfg, setCfg] = useState({
    title: quiz?.title ?? '',
    passScorePercent: String(quiz?.passScorePercent ?? 70),
    timeLimitMinutes: quiz?.timeLimitMinutes ? String(quiz.timeLimitMinutes) : '',
    maxAttempts: quiz?.maxAttempts ? String(quiz.maxAttempts) : '',
    retryCooldownMinutes: String(quiz?.retryCooldownMinutes ?? 0),
    shuffleQuestions: quiz?.shuffleQuestions ?? false,
    shuffleOptions: quiz?.shuffleOptions ?? false,
    showAnswersAfterSubmit: quiz?.showAnswersAfterSubmit ?? true,
  });
  const [open, setOpen] = useState<number | 'new' | null>(null);
  const saveCfg = useMutation({
    mutationFn: () =>
      api(`/admin/lessons/${lessonId}/quiz`, {
        method: 'PUT',
        body: {
          ...cfg,
          passScorePercent: Number(cfg.passScorePercent),
          timeLimitMinutes: cfg.timeLimitMinutes ? Number(cfg.timeLimitMinutes) : null,
          maxAttempts: cfg.maxAttempts ? Number(cfg.maxAttempts) : null,
          retryCooldownMinutes: Number(cfg.retryCooldownMinutes || 0),
        },
      }),
    onSuccess: () => {
      toast(quiz ? 'Đã lưu cấu hình quiz' : 'Đã bật quiz cho bài học');
      onChange();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const removeQuiz = useMutation({
    mutationFn: () => api(`/admin/lessons/${lessonId}/quiz`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Đã tắt quiz', 'info');
      onChange();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const importCsv = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await api<{ created: number; errors: string[] }>(`/admin/quizzes/${quiz!.id}/questions/import`, { method: 'POST', form });
      toast(`Đã nhập ${r.created} câu hỏi${r.errors.length ? `, ${r.errors.length} dòng lỗi: ${r.errors.slice(0, 3).join('; ')}` : ''}`, r.errors.length ? 'error' : 'success');
      onChange();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const total = quiz?.questions.reduce((s, x) => s + Number(x.points), 0) ?? 0;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="panel">
        <div className="panel-h">
          <h3>Cấu hình quiz</h3>
          <span className="row" style={{ gap: 10 }}>
            <span className="small bold">Bật quiz</span>
            <Toggle
              on={!!quiz}
              label="Bật quiz"
              onChange={async (v) => {
                if (v) saveCfg.mutate();
                else if ((await confirm({ title: 'Tắt quiz của bài học?', body: 'Toàn bộ câu hỏi sẽ bị xóa. Không thể tắt nếu quiz đã có người làm.', confirmText: 'Tắt quiz', danger: true })).ok) removeQuiz.mutate();
              }}
            />
          </span>
        </div>
        <div className="panel-b stack" style={{ gap: 18 }}>
          <div className="grid-4" style={{ gap: 16 }}>
            <Field label="Điểm đạt (%)">
              <input className="input" type="number" min={0} max={100} value={cfg.passScorePercent} onChange={(e) => setCfg({ ...cfg, passScorePercent: e.target.value })} />
            </Field>
            <Field label="Thời gian (phút)" hint="Trống = không giới hạn">
              <input className="input" type="number" min={1} value={cfg.timeLimitMinutes} onChange={(e) => setCfg({ ...cfg, timeLimitMinutes: e.target.value })} />
            </Field>
            <Field label="Số lần làm tối đa" hint="Trống = không giới hạn">
              <input className="input" type="number" min={1} value={cfg.maxAttempts} onChange={(e) => setCfg({ ...cfg, maxAttempts: e.target.value })} />
            </Field>
            <Field label="Chờ giữa 2 lần (phút)">
              <input className="input" type="number" min={0} value={cfg.retryCooldownMinutes} onChange={(e) => setCfg({ ...cfg, retryCooldownMinutes: e.target.value })} />
            </Field>
          </div>
          <div className="row" style={{ gap: 28, flexWrap: 'wrap' }}>
            {(
              [
                ['shuffleQuestions', 'Xáo trộn câu hỏi'],
                ['shuffleOptions', 'Xáo trộn đáp án'],
                ['showAnswersAfterSubmit', 'Cho xem đáp án sau khi nộp'],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="check" style={{ cursor: 'pointer' }}>
                <input type="checkbox" className="sr-only" checked={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} />
                <span className={`box${cfg[k] ? ' on' : ''}`}>{cfg[k] && <Icon name="check" size="sm" />}</span>
                {l}
              </label>
            ))}
          </div>
          <button className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => saveCfg.mutate()} disabled={saveCfg.isPending}>
            {quiz ? 'Lưu cấu hình' : 'Bật quiz với cấu hình này'}
          </button>
        </div>
      </div>

      {quiz && (
        <div className="panel">
          <div className="panel-h" style={{ flexWrap: 'wrap', gap: 10 }}>
            <h3>
              Câu hỏi · tổng {formatNumber(total)} điểm
              {quiz.attemptCount > 0 && <span className="small muted" style={{ fontWeight: 500 }}> · {formatNumber(quiz.attemptCount)} lượt làm</span>}
            </h3>
            <div className="row">
              <label className="btn btn-light btn-sm" title="CSV UTF-8: loai;noi_dung;diem;giai_thich;dap_an_1;...; đáp án đúng có tiền tố *">
                <Icon name="upload" size="sm" />
                Nhập từ CSV
                <input type="file" className="sr-only" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
              </label>
              <button className="btn btn-primary btn-sm" onClick={() => setOpen('new')}>
                <Icon name="plus" size="sm" />
                Thêm câu hỏi
              </button>
            </div>
          </div>
          <div className="panel-b stack" style={{ gap: 12 }}>
            {quiz.questions.length === 0 && open !== 'new' && <p className="muted">Chưa có câu hỏi. Quiz cần ít nhất 1 câu hỏi hợp lệ để khóa học được xuất bản.</p>}
            {quiz.questions.map((x, i) =>
              open === x.id ? (
                <QuestionEditor key={x.id} quizId={quiz.id} n={i + 1} question={x} onDone={() => { setOpen(null); onChange(); }} />
              ) : (
                <div key={x.id} className="qb-q">
                  <div className="qh" onClick={() => setOpen(x.id)}>
                    <span className="n">{i + 1}</span>
                    <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: x.content }} />
                    <span className="chip neutral">{TYPE_LABEL[x.type]}</span>
                    <span className="small muted">{formatNumber(x.points)} điểm</span>
                    <Icon name="chevron-down" size="sm" />
                  </div>
                </div>
              ),
            )}
            {open === 'new' && <QuestionEditor quizId={quiz.id} n={quiz.questions.length + 1} onDone={() => { setOpen(null); onChange(); }} />}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({ quizId, n, question, onDone }: { quizId: number; n: number; question?: QuestionForm; onDone: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [type, setType] = useState<QuestionForm['type']>(question?.type ?? 'SINGLE_CHOICE');
  const [content, setContent] = useState(question?.content ?? '');
  const [points, setPoints] = useState(String(question?.points ?? 1));
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [options, setOptions] = useState<OptionForm[]>(
    question?.options ?? [
      { content: '', isCorrect: true },
      { content: '', isCorrect: false },
    ],
  );
  const [error, setError] = useState('');
  const setTypeSafe = (t: QuestionForm['type']) => {
    setType(t);
    if (t === 'TRUE_FALSE') setOptions([{ content: 'Đúng', isCorrect: true }, { content: 'Sai', isCorrect: false }]);
    else if (t === 'SINGLE_CHOICE' && options.filter((o) => o.isCorrect).length !== 1) setOptions(options.map((o, i) => ({ ...o, isCorrect: i === 0 })));
  };
  const toggleCorrect = (i: number) =>
    setOptions(options.map((o, j) => (type === 'MULTIPLE_CHOICE' ? (j === i ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: j === i })));
  const save = useMutation({
    mutationFn: () => {
      const body = { content, type, points: Number(points), explanation, options };
      return question ? api(`/admin/questions/${question.id}`, { method: 'PUT', body }) : api(`/admin/quizzes/${quizId}/questions`, { method: 'POST', body });
    },
    onSuccess: () => {
      toast('Đã lưu câu hỏi');
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError && Object.keys(e.fieldErrors).length ? Object.values(e.fieldErrors)[0] : errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/admin/questions/${question!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Đã xóa câu hỏi', 'info');
      onDone();
    },
  });
  return (
    <div className="qb-q open">
      <div className="qh">
        <span className="n">{n}</span>
        <span style={{ flex: 1 }} className="bold">
          {question ? 'Sửa câu hỏi' : 'Câu hỏi mới'}
        </span>
        {question && (
          <div className="acts">
            <a className="danger" aria-label="Xóa câu hỏi" onClick={async () => (await confirm({ title: 'Xóa câu hỏi này?', body: question.answerCount > 0 ? 'Câu hỏi đã có người trả lời nên sẽ được gỡ khỏi quiz nhưng vẫn lưu trong lịch sử.' : undefined, confirmText: 'Xóa', danger: true, icon: 'trash' })).ok && remove.mutate()}>
              <Icon name="trash" size="sm" />
            </a>
          </div>
        )}
        <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={onDone} aria-label="Đóng">
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="qb">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="seg3">
            {(Object.keys(TYPE_LABEL) as QuestionForm['type'][]).map((t) => (
              <button key={t} type="button" className={type === t ? 'on' : ''} onClick={() => setTypeSafe(t)}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <label className="row small">
            <span className="bold">Điểm</span>
            <input className="input" style={{ width: 80, height: 40 }} type="number" min={0.25} step={0.25} value={points} onChange={(e) => setPoints(e.target.value)} />
          </label>
        </div>
        <Field label="Nội dung câu hỏi" required>
          <RichEditor small value={content} onChange={setContent} />
        </Field>
        <Field label={`Đáp án (2–8) — ${type === 'MULTIPLE_CHOICE' ? 'đánh dấu tất cả đáp án đúng' : 'chọn 1 đáp án đúng'}`} required>
          <div className="stack" style={{ gap: 8 }}>
            {options.map((o, i) => (
              <div key={i} className={`optrow${o.isCorrect ? ' ok' : ''}`}>
                <button type="button" className={type === 'MULTIPLE_CHOICE' ? `box${o.isCorrect ? ' on' : ''}` : `radio${o.isCorrect ? ' on' : ''}`} style={{ border: undefined, cursor: 'pointer' }} onClick={() => toggleCorrect(i)} aria-label="Đánh dấu đáp án đúng" aria-pressed={o.isCorrect}>
                  {type === 'MULTIPLE_CHOICE' && o.isCorrect && <Icon name="check" size="sm" />}
                </button>
                <input className="input" value={o.content} disabled={type === 'TRUE_FALSE'} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))} placeholder={`Đáp án ${i + 1}`} />
                {type !== 'TRUE_FALSE' && options.length > 2 && (
                  <button type="button" className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Xóa đáp án">
                    <Icon name="x" size="sm" />
                  </button>
                )}
              </div>
            ))}
            {type !== 'TRUE_FALSE' && options.length < 8 && (
              <button type="button" className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setOptions([...options, { content: '', isCorrect: false }])}>
                <Icon name="plus" size="sm" /> Thêm đáp án
              </button>
            )}
          </div>
        </Field>
        <Field label="Giải thích (hiện sau khi nộp)">
          <RichEditor small value={explanation} onChange={setExplanation} />
        </Field>
        {question && question.answerCount > 0 && (
          <div className="alert warn" style={{ fontSize: 14 }}>
            <Icon name="alert" size="sm" />
            <span>
              Câu hỏi này đã có <b>{formatNumber(question.answerCount)} lượt trả lời</b>. Đổi đáp án đúng sẽ làm sai lệch điểm cũ — hãy chạy <b>"Tính lại xếp hạng"</b> ở tab Xếp hạng của khóa học sau khi lưu.
            </span>
          </div>
        )}
        {error && (
          <div className="alert error" style={{ fontSize: 14 }}>
            <Icon name="alert" size="sm" />
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-light" onClick={onDone}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending || !content.trim()}>
            Lưu câu hỏi
          </button>
        </div>
      </div>
    </div>
  );
}
