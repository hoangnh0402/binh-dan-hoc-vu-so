import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Dev: API Spring Boot chạy ở cổng 8081 (cổng 8080 thường bị ứng dụng khác chiếm).
const api = process.env.VITE_API_TARGET ?? 'http://localhost:8081';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    // Node mặc định chỉ nghe ::1 (IPv6) → trình duyệt/proxy dùng 127.0.0.1 không vào được.
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': { target: api, changeOrigin: false },
      '/files': { target: api, changeOrigin: false },
    },
  },
});
