/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PROXY_TARGET?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  /** "off" skips the Socket.io connection (serverless hosting). */
  readonly VITE_REALTIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
