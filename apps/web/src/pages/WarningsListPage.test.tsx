import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStats } from '../api/hazardReports';
import { listWarnings } from '../api/hazardWarnings';
import { stats, warning } from '../test/fixtures';
import { renderPage } from '../test/render';
import { WarningsListPage } from './WarningsListPage';

vi.mock('../api/hazardReports', () => ({ getStats: vi.fn() }));
vi.mock('../api/hazardWarnings', async () => {
  const actual = await vi.importActual<typeof import('../api/hazardWarnings')>(
    '../api/hazardWarnings',
  );
  return { ...actual, listWarnings: vi.fn() };
});

const page = (items = [warning()], total = items.length) => ({
  items,
  total,
  page: 1,
  limit: 20,
});

describe('WarningsListPage', () => {
  beforeEach(() => {
    vi.mocked(getStats).mockResolvedValue(stats);
    vi.mocked(listWarnings).mockReset().mockResolvedValue(page());
  });

  it('lists active warnings with a link to their status', async () => {
    renderPage(<WarningsListPage />, { at: '/warnings', path: '/warnings' });

    expect(
      await screen.findByRole('link', { name: 'View HW-2026-0007' }),
    ).toHaveAttribute('href', '/warnings/6700aa77bcf86cd799439011');
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(listWarnings).toHaveBeenCalledWith(
      { view: 'active', page: 1, limit: 20 },
      expect.any(AbortSignal),
    );
  });

  it('switches to drafts and links each to its editor', async () => {
    vi.mocked(listWarnings).mockResolvedValue(
      page([warning({ status: 'DRAFT', active: false })]),
    );
    renderPage(<WarningsListPage />, { at: '/warnings', path: '/warnings' });

    await userEvent.click(await screen.findByRole('tab', { name: 'Drafts' }));

    expect(
      await screen.findByRole('link', { name: 'Edit HW-2026-0007' }),
    ).toHaveAttribute('href', '/warnings/6700aa77bcf86cd799439011/edit');
    expect(listWarnings).toHaveBeenLastCalledWith(
      { view: 'drafts', page: 1, limit: 20 },
      expect.any(AbortSignal),
    );
  });

  it('shows the notice it was opened with', async () => {
    renderPage(<WarningsListPage />, {
      at: {
        pathname: '/warnings',
        search: '?view=drafts',
        state: { notice: 'Draft HW-2026-0008 saved.' },
      },
      path: '/warnings',
    });
    expect(
      await screen.findByText('Draft HW-2026-0008 saved.'),
    ).toBeInTheDocument();
  });

  it('says when there is nothing to show', async () => {
    vi.mocked(listWarnings).mockResolvedValue(page([]));
    renderPage(<WarningsListPage />, { at: '/warnings', path: '/warnings' });
    expect(await screen.findByText('No active warnings')).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    vi.mocked(listWarnings)
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(page());
    renderPage(<WarningsListPage />, { at: '/warnings', path: '/warnings' });

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('link', { name: 'View HW-2026-0007' }),
    ).toBeInTheDocument();
  });
});
