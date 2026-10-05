/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Stand-in for officer login, which is out of scope. Visible in the built bundle. */
  readonly VITE_OFFICER_KEY?: string;
  readonly VITE_OFFICER_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
