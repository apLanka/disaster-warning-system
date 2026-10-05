import { useEffect } from 'react';

const APP_NAME = 'DMC Portal';

/** Keeps the browser tab and screen reader page title in step with the screen. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}
