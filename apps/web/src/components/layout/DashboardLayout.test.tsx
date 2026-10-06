import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchHealth } from '../../api/health';
import { getStats } from '../../api/hazardReports';
import { stats } from '../../test/fixtures';
import { DashboardLayout } from './DashboardLayout';

vi.mock('../../api/hazardReports', () => ({ getStats: vi.fn() }));
vi.mock('../../api/health', () => ({ fetchHealth: vi.fn() }));

function renderLayout(at = '/reports/pending') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="*" element={<p>page content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.mocked(getStats).mockReset().mockResolvedValue(stats);
    vi.mocked(fetchHealth).mockReset().mockResolvedValue({
      status: 'ok',
      service: 'api',
      timestamp: '2026-10-05T10:00:00.000Z',
    });
  });

  it('shows the page inside the layout', () => {
    renderLayout();

    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });

  it('lists the report pages in the sidebar and marks the current one', () => {
    renderLayout('/reports/verified');

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(
      within(nav).getByRole('link', { name: /Pending Reports/ }),
    ).toHaveAttribute('href', '/reports/pending');
    expect(
      within(nav).getByRole('link', { name: /Verified Reports/ }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav).getByRole('link', { name: /Rejected Reports/ }),
    ).not.toHaveAttribute('aria-current');
  });

  it('shows how many reports are waiting, in words for screen readers', async () => {
    renderLayout();

    const link = await screen.findByRole('link', { name: /12 pending/ });
    expect(link).toHaveTextContent('Pending Reports');
  });

  it('shows no badge when nothing is waiting', async () => {
    vi.mocked(getStats).mockResolvedValue({ ...stats, pending: 0 });

    renderLayout();

    await screen.findByRole('link', { name: '0 reports waiting for review' });
    expect(screen.queryByText(/pending:/)).not.toBeInTheDocument();
  });

  it('labels the bell with the number of waiting reports', async () => {
    renderLayout();

    expect(
      await screen.findByRole('link', {
        name: '12 reports waiting for review',
      }),
    ).toHaveAttribute('href', '/reports/pending');
  });

  it('uses the singular for one waiting report', async () => {
    vi.mocked(getStats).mockResolvedValue({ ...stats, pending: 1 });

    renderLayout();

    expect(
      await screen.findByRole('link', { name: '1 report waiting for review' }),
    ).toBeInTheDocument();
  });

  it('caps a large count on the bell at 9+', async () => {
    renderLayout();

    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  it('shows the officer who is on duty', () => {
    renderLayout();

    expect(screen.getByText('Duty Officer')).toBeInTheDocument();
    expect(screen.getByText('On duty')).toBeInTheDocument();
  });

  it('shows whether the API is reachable', async () => {
    renderLayout();

    expect(await screen.findByText('api: ok')).toBeInTheDocument();
  });

  it('says so when the API is unreachable', async () => {
    vi.mocked(fetchHealth).mockRejectedValue(new Error('offline'));

    renderLayout();

    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
  });

  it('opens and closes the navigation drawer on small screens', async () => {
    renderLayout();
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('button', { name: 'Open navigation' }),
    );
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(2);

    await userEvent.click(
      screen.getByRole('button', { name: 'Close navigation' }),
    );
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });

  it('closes the drawer after choosing a page', async () => {
    renderLayout();
    await userEvent.click(
      screen.getByRole('button', { name: 'Open navigation' }),
    );

    const drawer = screen.getAllByRole('navigation', { name: 'Main' })[1]!;
    await userEvent.click(
      within(drawer).getByRole('link', { name: /Rejected Reports/ }),
    );

    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });
});
