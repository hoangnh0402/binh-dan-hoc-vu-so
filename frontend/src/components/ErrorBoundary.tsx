import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Bắt lỗi render để không bao giờ để người dùng nhìn trang trắng. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi hiển thị trang:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // Tải chunk thất bại thường do bản build/dev server vừa thay đổi → tải lại là hết.
    const stale = /dynamically imported module|Failed to fetch|Importing a module script failed|error loading/i.test(error.message);
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 16px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 24, color: '#962521' }}>Không thể hiển thị trang</h1>
        <p style={{ color: '#555', lineHeight: 1.6 }}>
          {stale
            ? 'Trang vừa được cập nhật phiên bản mới. Vui lòng tải lại trang.'
            : 'Đã xảy ra lỗi khi hiển thị trang. Vui lòng tải lại; nếu vẫn lỗi, hãy liên hệ bộ phận hỗ trợ.'}
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Tải lại trang
        </button>
        <pre style={{ marginTop: 24, textAlign: 'left', fontSize: 12, color: '#888', whiteSpace: 'pre-wrap' }}>{error.message}</pre>
      </div>
    );
  }
}
