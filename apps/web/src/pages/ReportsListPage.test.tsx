import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError } from '../api/client';
import { getStats, listReports } from '../api/hazardReports';
import { decidedReport, NOW, page, report, stats } from '../test/fixtures';
import { renderPage } from '../test/render';
import { ReportsListPage } from './ReportsListPage';

vi.mock('../api/hazardReports', () => ({
  listReports: vi.fn(),
  getStats: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const lastQuery = () => vi.mocked(listReports).mock.calls.at(-1)![0];

function renderPending(at = '/reports/pending') {
  return renderPage(<ReportsListPage status="PENDING_VERIFICATION" />, { at });
}

describe('ReportsListPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getStats).mockReset().mockResolvedValue(stats);
    vi.mocked(listReports)
      .mockReset()
      .mockResolvedValue(
        page(
          [
            report({ id: 'a' }),
            report({ id: 'b', reference: 'HR-2026-0411', type: 'LANDSLIDE' }),
          ],
          { total: 12 },
        ),
      );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('pending reports', () => {
    it('shows the title, the counts, and the reports', async () => {
      renderPending();

      expect(
        screen.getByRole('heading', { name: 'Pending Hazard Reports' }),
      ).toBeInTheDocument();
      expect(await screen.findByText('HR-2026-0411')).toBeInTheDocument();
      expect(await screen.findByText('136')).toBeInTheDocument();
      expect(screen.getByText('Pending Reports')).toBeInTheDocument();
      expect(screen.getByText('Verified Today')).toBeInTheDocument();
      expect(screen.getByText('24')).toBeInTheDocument();
      expect(screen.getByText('12 reports')).toBeInTheDocument();
    });

    it('asks for pending reports, newest first, ten at a time, by default', async () => {
      renderPending();
      await screen.findByText('HR-2026-0411');

      expect(lastQuery()).toEqual({
        status: 'PENDING_VERIFICATION',
        type: undefined,
        sort: 'newest',
        page: 1,
        limit: 10,
      });
    });

    it('shows loading placeholders, not a blank page, while the first load runs', async () => {
      const slow = deferred<ReturnType<typeof page>>();
      vi.mocked(listReports).mockReturnValue(slow.promise);

      renderPending();

      expect(
        screen.getByRole('status', { name: 'Loading reports' }),
      ).toBeInTheDocument();
      slow.resolve(page([report()]));
      await screen.findByText('HR-2026-0412');
      expect(
        screen.queryByRole('status', { name: 'Loading reports' }),
      ).not.toBeInTheDocument();
    });

    it('filters by hazard type and starts again from page 1', async () => {
      renderPending('/reports/pending?page=2');
      await screen.findByText('HR-2026-0411');

      await userEvent.selectOptions(
        screen.getByLabelText('Hazard type'),
        'LANDSLIDE',
      );

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ type: 'LANDSLIDE', page: 1 }),
      );
    });

    it('sorts oldest first and back to newest', async () => {
      renderPending();
      await screen.findByText('HR-2026-0411');

      await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'oldest');
      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ sort: 'oldest' }),
      );

      await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'newest');
      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ sort: 'newest' }),
      );
    });

    it('moves to the next page and keeps the row numbering going', async () => {
      renderPending();
      await screen.findByText('HR-2026-0411');

      await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

      await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2 }));
      expect(await screen.findByText('11')).toBeInTheDocument();
    });

    it('reads filters from the address so a link can be shared', async () => {
      renderPending('/reports/pending?type=FLOOD&sort=oldest&page=3');
      await screen.findByText('HR-2026-0411');

      expect(lastQuery()).toMatchObject({
        type: 'FLOOD',
        sort: 'oldest',
        page: 3,
      });
      expect(screen.getByLabelText('Hazard type')).toHaveValue('FLOOD');
      expect(screen.getByLabelText('Sort by')).toHaveValue('oldest');
    });

    it.each([
      ['an unknown hazard type', '?type=TORNADO'],
      ['a negative page', '?page=-3'],
      ['a non-numeric page', '?page=abc'],
      ['an unknown sort', '?sort=random'],
    ])(
      'falls back to the defaults for %s in the address',
      async (_name, search) => {
        renderPending(`/reports/pending${search}`);
        await screen.findByText('HR-2026-0411');

        expect(lastQuery()).toEqual({
          status: 'PENDING_VERIFICATION',
          type: undefined,
          sort: 'newest',
          page: 1,
          limit: 10,
        });
      },
    );

    it('explains an empty queue', async () => {
      vi.mocked(listReports).mockResolvedValue(page([]));

      renderPending();

      expect(
        await screen.findByText('No reports are waiting for review'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('New citizen reports will appear here.'),
      ).toBeInTheDocument();
    });

    it('explains an empty filter result and offers to clear it', async () => {
      vi.mocked(listReports).mockResolvedValue(page([]));
      renderPending('/reports/pending?type=FLOOD');

      expect(
        await screen.findByText('No reports match these filters'),
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Clear filters' }),
      );

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ type: undefined }),
      );
    });

    it('shows a plain error with Retry when loading fails, then recovers', async () => {
      vi.mocked(listReports).mockRejectedValueOnce(new NetworkError());

      renderPending();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Cannot reach the server',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByText('HR-2026-0411')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps the reports on screen when a refresh fails', async () => {
      renderPending();
      await screen.findByText('HR-2026-0411');
      vi.mocked(listReports).mockRejectedValueOnce(new ApiError(500, 'boom'));

      await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The server hit a problem',
      );
      expect(screen.getByText('HR-2026-0411')).toBeInTheDocument();
    });

    it('refreshes the list and the counts together', async () => {
      renderPending();
      await screen.findByText('HR-2026-0411');
      const listCalls = vi.mocked(listReports).mock.calls.length;
      const statCalls = vi.mocked(getStats).mock.calls.length;

      await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

      await waitFor(() =>
        expect(listReports).toHaveBeenCalledTimes(listCalls + 1),
      );
      expect(getStats).toHaveBeenCalledTimes(statCalls + 1);
    });

    it('shows the outcome of the last decision', async () => {
      renderPage(<ReportsListPage status="PENDING_VERIFICATION" />, {
        at: {
          pathname: '/reports/pending',
          state: { notice: 'Report HR-2026-0412 verified.' },
        },
      });

      expect(await screen.findByRole('status', { name: '' })).toHaveTextContent(
        'Report HR-2026-0412 verified.',
      );
    });

    it('links each row to its review page', async () => {
      renderPending();

      const link = await screen.findByRole('link', {
        name: 'View report HR-2026-0411',
      });

      expect(link).toHaveAttribute('href', '/reports/b');
    });
  });

  describe('decided lists', () => {
    it('lists verified reports without the stat cards', async () => {
      vi.mocked(listReports).mockResolvedValue(
        page([decidedReport('VERIFIED')]),
      );

      renderPage(<ReportsListPage status="VERIFIED" />, {
        at: '/reports/verified',
      });

      expect(
        screen.getByRole('heading', { name: 'Verified Reports' }),
      ).toBeInTheDocument();
      expect(await screen.findByText('HR-2026-0412')).toBeInTheDocument();
      expect(lastQuery()).toMatchObject({ status: 'VERIFIED' });
      expect(screen.queryByText('Verified Today')).not.toBeInTheDocument();
      expect(
        screen.getByRole('columnheader', { name: 'Decision' }),
      ).toBeInTheDocument();
    });

    it('lists rejected reports with the reason', async () => {
      vi.mocked(listReports).mockResolvedValue(
        page([decidedReport('REJECTED')]),
      );

      renderPage(<ReportsListPage status="REJECTED" />, {
        at: '/reports/rejected',
      });

      expect(
        await screen.findByText(/Insufficient information/),
      ).toBeInTheDocument();
      expect(lastQuery()).toMatchObject({ status: 'REJECTED' });
    });

    it('has its own empty message', async () => {
      vi.mocked(listReports).mockResolvedValue(page([]));

      renderPage(<ReportsListPage status="REJECTED" />, {
        at: '/reports/rejected',
      });

      expect(
        await screen.findByText('No rejected reports'),
      ).toBeInTheDocument();
    });
  });

  it('shows a singular count for one report', async () => {
    vi.mocked(listReports).mockResolvedValue(page([report()]));

    renderPending();

    expect(await screen.findByText('1 report')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
  });
});
