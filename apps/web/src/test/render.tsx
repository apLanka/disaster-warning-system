import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ReportStatsProvider } from '../context/ReportStatsProvider';

interface Options {
  /** Where the router starts, including any query string, optionally with router state. */
  at?: string | { pathname: string; search?: string; state?: unknown };
  /** The route pattern the element is mounted on. */
  path?: string;
  /** Adds a stand-in for the pending list, to assert that a page navigated there. */
  pendingStub?: boolean;
}

/** Renders a page the way the app does: inside a router and the shared stats provider. */
export function renderPage(
  element: ReactElement,
  { at = '/', path = '*', pendingStub = false }: Options = {},
) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <ReportStatsProvider>
        <Routes>
          <Route path={path} element={element} />
          {pendingStub && (
            <Route path="/reports/pending" element={<p>Pending list page</p>} />
          )}
        </Routes>
      </ReportStatsProvider>
    </MemoryRouter>,
  );
}
