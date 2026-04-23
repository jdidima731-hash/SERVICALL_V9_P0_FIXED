/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FRONTEND_FORGE_API_KEY: string;
  readonly VITE_FRONTEND_FORGE_API_URL: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_API_URL: string;
  readonly VITE_MODE: string;
  readonly MODE: string;
  readonly VITE_ENCRYPTION_KEY?: string; // ✅ FIX PAGE BLANCHE
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
