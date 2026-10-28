/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' để bật chế độ DEMO (FE tự phục vụ dữ liệu, không cần backend). */
  readonly VITE_DEMO?: string;
  readonly VITE_API_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
