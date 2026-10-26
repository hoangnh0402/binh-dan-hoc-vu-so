import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { ApiError } from '@/api/client';

// ------------------------------------------------------------------ Toast

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon
              name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check-circle'}
              style={{ color: t.kind === 'error' ? 'var(--error)' : t.kind === 'info' ? 'var(--red)' : 'var(--success)' }}
            />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function errorMessage(e: unknown) {
  if (e instanceof ApiError) return e.message;
  return 'Không kết nối được máy chủ, vui lòng thử lại';
}

// ------------------------------------------------------------------ Modal / Confirm

export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dlg${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmText: string;
  cancelText?: string;
  tone?: 'red' | 'warn' | 'brand' | 'ok';
  icon?: string;
  danger?: boolean;
  /** Ô nhập lý do bắt buộc (khóa tài khoản, ẩn đánh giá…). */
  reason?: { label: string; placeholder?: string };
  reference?: string;
}

type ConfirmFn = (o: ConfirmOptions) => Promise<{ ok: boolean; reason?: string }>;
const ConfirmCtx = createContext<ConfirmFn>(async () => ({ ok: false }));

/** Hộp thoại xác nhận cho thao tác không hoàn tác được (NFR-UX-05). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (r: { ok: boolean; reason?: string }) => void }) | null>(null);
  const [reason, setReason] = useState('');
  const confirm: ConfirmFn = useCallback(
    (o) =>
      new Promise((resolve) => {
        setReason('');
        setState({ ...o, resolve });
      }),
    [],
  );
  const close = (ok: boolean) => {
    state?.resolve({ ok, reason: reason.trim() || undefined });
    setState(null);
  };
  const needReason = !!state?.reason;
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)}>
        {state && (
          <>
            <div className="b">
              <div className="hd">
                <span className={`ic ${state.tone ?? (state.danger ? 'red' : 'brand')}`}>
                  <Icon name={state.icon ?? (state.danger ? 'alert' : 'info')} />
                </span>
                <div>
                  <h3>{state.title}</h3>
                  {state.reference && <span className="xs muted">{state.reference}</span>}
                </div>
                <button className="x" onClick={() => close(false)} aria-label="Đóng">
                  <Icon name="x" />
                </button>
              </div>
              {typeof state.body === 'string' ? <p>{state.body}</p> : state.body}
              {state.reason && (
                <div className="field">
                  <label>
                    {state.reason.label} <span className="req">*</span>
                  </label>
                  <textarea
                    className="textarea"
                    style={{ height: 90 }}
                    value={reason}
                    placeholder={state.reason.placeholder}
                    onChange={(e) => setReason(e.target.value)}
                    autoFocus
                  />
                  <span className="hint">Lý do được lưu vào nhật ký thao tác.</span>
                </div>
              )}
            </div>
            <div className="f">
              <button className="btn btn-light" onClick={() => close(false)}>
                {state.cancelText ?? 'Hủy'}
              </button>
              <button
                className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => close(true)}
                disabled={needReason && !reason.trim()}
              >
                {state.danger && <Icon name={state.icon ?? 'alert'} size="sm" />}
                {state.confirmText}
              </button>
            </div>
          </>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);

// ------------------------------------------------------------------ nhỏ

export function Spinner({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div className="center-box" aria-busy="true">
      <div className="spinner" />
      <span className="muted small">{label}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="center-box">
      <Icon name="alert" size="lg" style={{ color: 'var(--error)' }} />
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button className="btn btn-light" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export function Empty({ icon = 'book', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <div className="bold" style={{ fontSize: 17, color: 'var(--ink)' }}>
        {title}
      </div>
      {children && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages: (number | '…')[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  return (
    <nav className="pager" aria-label="Phân trang">
      <button disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Trang trước">
        <Icon name="chevron-left" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <button key={'e' + i} disabled>
            …
          </button>
        ) : (
          <button key={p} className={p === page ? 'on' : ''} onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}>
            {p + 1}
          </button>
        ),
      )}
      <button disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)} aria-label="Trang sau">
        <Icon name="chevron-right" />
      </button>
    </nav>
  );
}

export function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  return (
    <span className="stars" aria-label={`${value} sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size === 'lg' ? undefined : 'sm'} className={i <= Math.round(value) ? '' : 'off'} />
      ))}
    </span>
  );
}

export function Progress({ value, tone, lg }: { value: number; tone?: 'warn' | 'success'; lg?: boolean }) {
  return (
    <div className={`progress${lg ? ' lg' : ''}${tone === 'warn' ? ' warn' : ''}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${value}%`, background: tone === 'success' ? 'var(--success)' : undefined }} />
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? '' : ' off'}`} onClick={() => onChange(!on)} />;
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="check" style={{ cursor: 'pointer' }}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`box${checked ? ' on' : ''}`}>{checked && <Icon name="check" size="sm" />}</span>
      <span>{children}</span>
    </label>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`field${className ? ' ' + className : ''}`}>
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
      {error ? (
        <span className="err">
          <Icon name="alert" size="sm" />
          {error}
        </span>
      ) : (
        hint && <span className="hint">{hint}</span>
      )}
    </div>
  );
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [show, setShow] = useState(false);
  const { invalid, className, ...rest } = props;
  return (
    <div className="pw">
      <input {...rest} type={show ? 'text' : 'password'} className={`input${invalid ? ' invalid' : ''} ${className ?? ''}`} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 0, padding: 6, color: 'var(--ink-3)' }}>
        <Icon name="eye" />
      </button>
    </div>
  );
}

/** Đếm lùi theo giây, trả về số giây còn lại. */
export function useCountdown(targetIso?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetIso]);
  if (!targetIso) return null;
  return Math.max(0, Math.floor((new Date(targetIso).getTime() - now) / 1000));
}

export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Html({ html, className = 'prose-html' }: { html?: string | null; className?: string }) {
  // Nội dung đã được backend làm sạch (jsoup Safelist) trước khi lưu.
  if (!html) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
