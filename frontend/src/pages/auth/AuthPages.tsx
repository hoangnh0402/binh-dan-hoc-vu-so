import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '@/api/client';
import type { TokenResponse } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Icon } from '@/components/Icon';
import { Checkbox, Field, PasswordInput, errorMessage, useCountdown, useToast } from '@/components/ui';
import { formatClock } from '@/lib/format';
import { DEMO, DEMO_ACCOUNT, DEMO_ADMIN } from '@/demo/flag';

function AuthShell({ title, points, children }: { title: ReactNode; points: [string, string][]; children: ReactNode }) {
  return (
    <div className="auth auth-page">
      <section className="art">
        <Link className="brand" to="/">
          <span className="logo-bg">
            <img src="/logo-256.png" alt="Logo Trường Đại học Sư phạm Hà Nội 2" />
          </span>
          <div>
            <div className="name">Bình Dân Học Vụ Số</div>
            <div className="sub">Trường Đại học Sư phạm Hà Nội 2</div>
          </div>
        </Link>
        <div style={{ position: 'relative' }}>
          <h1>{title}</h1>
          <div className="pts">
            {points.map(([ic, t]) => (
              <span key={t}>
                <span className="ic">
                  <Icon name={ic} />
                </span>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="small" style={{ opacity: 0.8, position: 'relative' }}>
          © 2026 Trường Đại học Sư phạm Hà Nội 2
        </div>
      </section>
      <section className="form-side">{children}</section>
    </div>
  );
}

/** BR-AUTH-01: 8–64 ký tự, có chữ cái và chữ số, không trùng email. */
function passwordRules(pw: string, email?: string) {
  return [
    { ok: pw.length >= 8 && pw.length <= 64, label: '8–64 ký tự' },
    { ok: /\p{L}/u.test(pw) && /\d/.test(pw), label: 'Có chữ cái và chữ số' },
    { ok: !!pw && pw.toLowerCase() !== (email ?? '').toLowerCase(), label: 'Không trùng email' },
  ];
}

function PasswordStrength({ pw, email }: { pw: string; email?: string }) {
  const rules = passwordRules(pw, email);
  const score = rules.filter((r) => r.ok).length + (pw.length >= 12 && /[^\p{L}\d]/u.test(pw) ? 1 : 0);
  return (
    <>
      <div className="strength" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < score ? 'on' : ''} />
        ))}
      </div>
      <div className="rules">
        {rules.map((r) => (
          <span key={r.label} className={r.ok ? 'ok' : ''}>
            <Icon name={r.ok ? 'check' : 'x'} size="sm" />
            {r.label}
          </span>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Đăng nhập

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState(DEMO ? DEMO_ACCOUNT.email : '');
  const [password, setPassword] = useState(DEMO ? DEMO_ACCOUNT.password : '');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const doLogin = async (mail: string, pass: string) => {
    setError('');
    setBusy(true);
    try {
      const u = await login(mail.trim(), pass, remember);
      nav(from ?? (u.roles.includes('ADMIN') ? '/admin' : '/'), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_VERIFIED') {
        nav('/xac-thuc-otp', { state: { email: mail.trim(), sent: true } });
        return;
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    doLogin(email, password);
  };

  const quickDemo = () => {
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    doLogin(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
  };
  const quickAdmin = () => {
    setEmail(DEMO_ADMIN.email);
    setPassword(DEMO_ADMIN.password);
    doLogin(DEMO_ADMIN.email, DEMO_ADMIN.password);
  };

  return (
    <AuthShell
      title={
        <>
          Chào mừng bạn
          <br />
          quay lại học tập!
        </>
      }
      points={[
        ['book', 'Khóa học miễn phí về kỹ năng số, ngoại ngữ, sư phạm'],
        ['hourglass', 'Mỗi khóa học có thời hạn rõ ràng, thường là 3 tuần'],
        ['trophy', 'Làm quiz, ghi điểm và lên bảng xếp hạng'],
      ]}
    >
      <form className="form-card" onSubmit={submit} noValidate>
        <div className="seg">
          <a className="on">Đăng nhập</a>
          <Link to="/dang-ky">Đăng ký</Link>
        </div>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800 }}>Đăng nhập</h2>
          <p className="muted" style={{ marginTop: 6 }}>Dùng email bạn đã đăng ký tài khoản.</p>
        </div>
        <Field label="Email" required>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Mật khẩu" required error={error || undefined}>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!error} required />
        </Field>
        <div className="row-between">
          <Checkbox checked={remember} onChange={setRemember}>
            Ghi nhớ đăng nhập
          </Checkbox>
          <Link className="bold small" to="/quen-mat-khau">
            Quên mật khẩu?
          </Link>
        </div>
        {DEMO && (
          <div className="alert info" style={{ fontSize: 14 }}>
            <Icon name="info" size="sm" />
            <span>
              Bản dùng thử. Người học: <b>{DEMO_ACCOUNT.email}</b> / <b>{DEMO_ACCOUNT.password}</b>.
              {' '}Quản trị: <b>{DEMO_ADMIN.email}</b> / <b>{DEMO_ADMIN.password}</b>.
              {' '}Hoặc nhập bất kỳ email/mật khẩu nào để vào với vai trò người học.
            </span>
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy || !email || !password}>
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        {DEMO && (
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="btn btn-outline btn-lg" style={{ flex: 1 }} disabled={busy} onClick={quickDemo}>
              <Icon name="play" size="sm" />
              Vào học (demo)
            </button>
            <button type="button" className="btn btn-outline btn-lg" style={{ flex: 1 }} disabled={busy} onClick={quickAdmin}>
              <Icon name="shield" size="sm" />
              Vào Quản trị (demo)
            </button>
          </div>
        )}
        <p className="small" style={{ textAlign: 'center' }}>
          Chưa có tài khoản? <Link className="bold" to="/dang-ky">Đăng ký miễn phí</Link>
        </p>
      </form>
    </AuthShell>
  );
}

// ------------------------------------------------------------------ Đăng ký

export function RegisterPage() {
  const nav = useNavigate();
  const [f, setF] = useState({ fullName: '', email: '', password: '', confirmPassword: '', birthYear: '', phone: '', hometown: '', workplace: '' });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.fullName.trim().length < 2) errs.fullName = 'Vui lòng nhập họ và tên';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errs.email = 'Email không đúng định dạng';
    if (!passwordRules(f.password, f.email).every((r) => r.ok)) errs.password = 'Mật khẩu chưa đạt yêu cầu';
    if (f.password !== f.confirmPassword) errs.confirmPassword = 'Mật khẩu xác nhận không khớp';
    if (!consent) errs.privacyConsent = 'Bạn cần đồng ý để tiếp tục';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setGeneral('');
    try {
      await api('/auth/register', {
        method: 'POST',
        body: {
          ...f,
          email: f.email.trim(),
          birthYear: f.birthYear ? Number(f.birthYear) : null,
          privacyConsent: consent,
        },
      });
      nav('/xac-thuc-otp', { state: { email: f.email.trim().toLowerCase(), sent: true } });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else if (err instanceof ApiError && err.code === 'EMAIL_EXISTS') setErrors({ email: err.message });
      else setGeneral(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const year = new Date().getFullYear();
  return (
    <AuthShell
      title={
        <>
          Tạo tài khoản
          <br />
          học miễn phí
        </>
      }
      points={[
        ['mail', 'Xác thực email bằng mã OTP 6 chữ số'],
        ['book', 'Đăng ký học ngay các khóa kỹ năng số, ngoại ngữ'],
        ['shield', 'Thông tin cá nhân được bảo vệ theo Nghị định 13/2023/NĐ-CP'],
      ]}
    >
      <form className="form-card wide" onSubmit={submit} noValidate>
        <div className="seg">
          <Link to="/dang-nhap">Đăng nhập</Link>
          <a className="on">Đăng ký</a>
        </div>
        <div className="stepper">
          <span className="s on">
            <i>1</i>Thông tin
          </span>
          <span className="ln" />
          <span className="s">
            <i>2</i>Xác thực email
          </span>
          <span className="ln" />
          <span className="s">
            <i>3</i>Hoàn tất
          </span>
        </div>
        {general && (
          <div className="alert error">
            <Icon name="alert" />
            {general}
          </div>
        )}
        <Field label="Họ và tên" required error={errors.fullName}>
          <input className={`input${errors.fullName ? ' invalid' : ''}`} value={f.fullName} onChange={set('fullName')} autoComplete="name" maxLength={100} />
        </Field>
        <Field label="Email" required error={errors.email} hint="Mã xác thực sẽ được gửi tới email này.">
          <input className={`input${errors.email ? ' invalid' : ''}`} type="email" value={f.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <div className="fg2">
          <Field label="Mật khẩu" required error={errors.password}>
            <PasswordInput value={f.password} onChange={set('password')} autoComplete="new-password" invalid={!!errors.password} />
            <PasswordStrength pw={f.password} email={f.email} />
          </Field>
          <Field label="Xác nhận mật khẩu" required error={errors.confirmPassword}>
            <PasswordInput value={f.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" invalid={!!errors.confirmPassword} />
          </Field>
        </div>
        <div className="row" style={{ color: 'var(--ink-2)', fontWeight: 700, fontSize: 15 }}>
          Thông tin thêm (không bắt buộc)
          <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>
        <div className="fg2">
          <Field label="Năm sinh" error={errors.birthYear}>
            <select className="input" value={f.birthYear} onChange={set('birthYear')}>
              <option value="">— Chọn năm —</option>
              {Array.from({ length: year - 1919 }, (_, i) => year - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Số điện thoại" error={errors.phone}>
            <input className="input" value={f.phone} onChange={set('phone')} placeholder="0912 345 678" inputMode="tel" />
          </Field>
          <Field label="Quê quán" error={errors.hometown}>
            <input className="input" value={f.hometown} onChange={set('hometown')} placeholder="Tỉnh/thành phố" maxLength={255} />
          </Field>
          <Field label="Nơi công tác" error={errors.workplace}>
            <input className="input" value={f.workplace} onChange={set('workplace')} maxLength={255} />
          </Field>
        </div>
        <div>
          <Checkbox checked={consent} onChange={setConsent}>
            Tôi đồng ý với{' '}
            <Link className="bold" to="/dieu-khoan" target="_blank">
              Điều khoản sử dụng
            </Link>{' '}
            và{' '}
            <Link className="bold" to="/chinh-sach-du-lieu" target="_blank">
              Chính sách bảo vệ dữ liệu cá nhân
            </Link>{' '}
            <span className="req" style={{ color: 'var(--error)' }}>*</span>
          </Checkbox>
          {errors.privacyConsent && (
            <span className="err" style={{ marginTop: 6 }}>
              <Icon name="alert" size="sm" />
              {errors.privacyConsent}
            </span>
          )}
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Đang gửi...' : 'Đăng ký và nhận mã xác thực'}
        </button>
        <p className="small" style={{ textAlign: 'center' }}>
          Đã có tài khoản? <Link className="bold" to="/dang-nhap">Đăng nhập</Link>
        </p>
      </form>
    </AuthShell>
  );
}

// ------------------------------------------------------------------ OTP

function OtpInputs({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const setAt = (i: number, d: string) => {
    const arr = value.padEnd(6, ' ').split('');
    arr[i] = d || ' ';
    onChange(arr.join('').replace(/\s+$/, ''));
  };
  return (
    <div className="otp-inputs" onPaste={(e) => {
      const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (t) {
        e.preventDefault();
        onChange(t);
        refs.current[Math.min(5, t.length)]?.focus();
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d.trim()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Chữ số ${i + 1}`}
          style={invalid ? { borderColor: 'var(--error)' } : undefined}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1);
            setAt(i, v);
            if (v) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d.trim()) refs.current[i - 1]?.focus();
          }}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}

function useResend(email: string, purpose: 'REGISTER' | 'RESET_PASSWORD', initiallySent: boolean) {
  const toast = useToast();
  const [sentAt, setSentAt] = useState<number | null>(initiallySent ? Date.now() : null);
  const otpLeft = useCountdown(sentAt ? new Date(sentAt + 5 * 60_000).toISOString() : null);
  const resendLeft = useCountdown(sentAt ? new Date(sentAt + 60_000).toISOString() : null);
  const resend = async () => {
    try {
      await api(purpose === 'REGISTER' ? '/auth/resend-otp' : '/auth/forgot-password', {
        method: 'POST',
        body: purpose === 'REGISTER' ? { email, purpose } : { email },
      });
      setSentAt(Date.now());
      toast('Đã gửi mã mới. Hãy kiểm tra email (cả thư mục Spam).', 'info');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return { otpLeft, resendLeft, resend, setSentAt };
}

export function VerifyOtpPage() {
  const loc = useLocation();
  const nav = useNavigate();
  const { applySession } = useAuth();
  const st = (loc.state as { email?: string; sent?: boolean } | null) ?? {};
  const [email] = useState(st.email ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { otpLeft, resendLeft, resend } = useResend(email, 'REGISTER', !!st.sent);

  useEffect(() => {
    if (!email) nav('/dang-ky', { replace: true });
  }, [email, nav]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError('');
    try {
      const s = await api<TokenResponse>('/auth/verify-otp', { method: 'POST', body: { email, code } });
      applySession(s);
      nav('/', { replace: true, state: { welcome: true } });
    } catch (err) {
      setError(errorMessage(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (code.length === 6) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="auth-page center-box" style={{ minHeight: '80vh' }}>
      <form className="form-card" onSubmit={submit} style={{ textAlign: 'center', alignItems: 'center', width: 520, maxWidth: '100%' }}>
        <div className="stepper" style={{ width: '100%' }}>
          <span className="s done">
            <i>✓</i>Thông tin
          </span>
          <span className="ln done" />
          <span className="s on">
            <i>2</i>Xác thực email
          </span>
          <span className="ln" />
          <span className="s">
            <i>3</i>Hoàn tất
          </span>
        </div>
        <span className="avatar" style={{ width: 72, height: 72 }}>
          <Icon name="mail" size="lg" />
        </span>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800 }}>Nhập mã xác thực</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            Chúng tôi đã gửi mã gồm 6 chữ số tới
            <br />
            <b style={{ color: 'var(--ink)' }}>{email}</b>
          </p>
        </div>
        <OtpInputs value={code} onChange={setCode} invalid={!!error} />
        {error && (
          <span className="err">
            <Icon name="alert" size="sm" />
            {error}
          </span>
        )}
        {otpLeft !== null && (
          <div className="deadline">
            <Icon name="clock" size="sm" />
            {otpLeft > 0 ? (
              <>
                Mã còn hiệu lực trong <b style={{ color: 'var(--red)' }}>{formatClock(otpLeft)}</b>
              </>
            ) : (
              'Mã đã hết hạn, vui lòng gửi lại mã'
            )}
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={code.length !== 6 || busy}>
          Xác nhận
        </button>
        <p className="small muted">
          Không nhận được mã? Kiểm tra thư mục Spam hoặc{' '}
          {resendLeft ? (
            <span className="bold">gửi lại mã sau {formatClock(resendLeft)}</span>
          ) : (
            <button type="button" className="link-btn" onClick={resend}>
              gửi lại mã
            </button>
          )}
        </p>
        <Link className="small bold" to="/dang-ky">
          <Icon name="chevron-left" size="sm" /> Đổi email đăng ký
        </Link>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ Quên mật khẩu (FR-AUTH-07)

export function ForgotPasswordPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { otpLeft, resendLeft, resend, setSentAt } = useResend(email, 'RESET_PASSWORD', false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page center-box" style={{ minHeight: '80vh' }}>
      <div className="form-card" style={{ width: 520, maxWidth: '100%' }}>
        <div className="stepper">
          {['Nhập email', 'Nhập mã', 'Mật khẩu mới'].map((l, i) => (
            <span key={l} className="row" style={{ gap: 8, flex: i < 2 ? 1 : undefined }}>
              <span className={`s ${step > i + 1 ? 'done' : step === i + 1 ? 'on' : ''}`}>
                <i>{step > i + 1 ? '✓' : i + 1}</i>
                {l}
              </span>
              {i < 2 && <span className={`ln ${step > i + 1 ? 'done' : ''}`} />}
            </span>
          ))}
        </div>
        {step === 1 && (
          <form
            className="stack"
            style={{ gap: 18 }}
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
                setSentAt(Date.now());
                setStep(2);
              });
            }}
          >
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800 }}>Quên mật khẩu?</h2>
              <p className="muted small" style={{ marginTop: 6 }}>Nhập email đã đăng ký, chúng tôi sẽ gửi mã xác thực để bạn đặt mật khẩu mới.</p>
            </div>
            <Field label="Email" required error={error || undefined}>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </Field>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy || !email}>
              Gửi mã xác thực
            </button>
            <Link className="small bold" to="/dang-nhap">
              <Icon name="chevron-left" size="sm" /> Quay lại đăng nhập
            </Link>
          </form>
        )}
        {step === 2 && (
          <form
            className="stack"
            style={{ gap: 18, alignItems: 'center', textAlign: 'center' }}
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const r = await api<{ resetToken: string }>('/auth/forgot-password/verify', { method: 'POST', body: { email: email.trim(), code } });
                setToken(r.resetToken);
                setStep(3);
              });
            }}
          >
            <div className="alert info" style={{ fontSize: 14, textAlign: 'left' }}>
              <Icon name="info" size="sm" />
              <span>Nếu email tồn tại trong hệ thống, mã xác thực đã được gửi. Hãy kiểm tra cả thư mục Spam.</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>Nhập mã xác thực</h2>
            <OtpInputs value={code} onChange={setCode} invalid={!!error} />
            {error && (
              <span className="err">
                <Icon name="alert" size="sm" />
                {error}
              </span>
            )}
            {otpLeft !== null && otpLeft > 0 && (
              <div className="deadline">
                <Icon name="clock" size="sm" />
                Mã còn hiệu lực <b style={{ color: 'var(--red)' }}>{formatClock(otpLeft)}</b>
              </div>
            )}
            <button className="btn btn-primary btn-lg btn-block" disabled={code.length !== 6 || busy}>
              Xác nhận
            </button>
            <p className="small muted">
              Chưa nhận được mã?{' '}
              {resendLeft ? (
                <span className="bold">Gửi lại sau {formatClock(resendLeft)}</span>
              ) : (
                <button type="button" className="link-btn" onClick={resend}>
                  Gửi lại mã
                </button>
              )}
            </p>
          </form>
        )}
        {step === 3 && (
          <form
            className="stack"
            style={{ gap: 18 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (pw !== pw2) {
                setError('Mật khẩu nhập lại không khớp');
                return;
              }
              run(async () => {
                await api('/auth/reset-password', { method: 'POST', body: { resetToken: token, newPassword: pw } });
                toast('Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.');
                nav('/dang-nhap', { replace: true });
              });
            }}
          >
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800 }}>Tạo mật khẩu mới</h2>
              <p className="muted small" style={{ marginTop: 6 }}>Phiên đặt lại mật khẩu có hiệu lực trong 10 phút.</p>
            </div>
            <Field label="Mật khẩu mới" required>
              <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              <PasswordStrength pw={pw} email={email} />
            </Field>
            <Field label="Nhập lại mật khẩu mới" required error={error || undefined}>
              <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </Field>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy || !passwordRules(pw, email).every((r) => r.ok)}>
              Đặt lại mật khẩu
            </button>
            <div className="alert success" style={{ fontSize: 14 }}>
              <Icon name="check-circle" size="sm" />
              <span>Sau khi đổi, bạn sẽ được đăng xuất khỏi mọi thiết bị và nhận email thông báo.</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Liên kết đặt mật khẩu do Admin gửi (FR-ADM-02, hiệu lực 24 giờ). */
export function SetPasswordPage() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const token = sp.get('token') ?? '';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setError('Mật khẩu nhập lại không khớp');
    try {
      await api('/auth/reset-password', { method: 'POST', body: { resetToken: token, newPassword: pw } });
      toast('Đã đặt mật khẩu. Vui lòng đăng nhập.');
      nav('/dang-nhap', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <div className="auth-page center-box" style={{ minHeight: '80vh' }}>
      <form className="form-card" onSubmit={submit}>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>Đặt mật khẩu cho tài khoản</h2>
        {!token && (
          <div className="alert error">
            <Icon name="alert" />
            Liên kết không hợp lệ.
          </div>
        )}
        <Field label="Mật khẩu mới" required>
          <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          <PasswordStrength pw={pw} />
        </Field>
        <Field label="Nhập lại mật khẩu" required error={error || undefined}>
          <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </Field>
        <button className="btn btn-primary btn-lg btn-block" disabled={!token || !passwordRules(pw).every((r) => r.ok)}>
          Lưu mật khẩu
        </button>
      </form>
    </div>
  );
}
