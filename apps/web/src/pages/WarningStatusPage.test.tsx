import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStats } from '../api/hazardReports';
import { cancelWarning, getWarning, retryWarning } from '../api/hazardWarnings';
import { ApiError } from '../api/client';
import { NOW, stats, warning, warningDetail } from '../test/fixtures';
import { renderPage } from '../test/render';
import { WarningStatusPage } from './WarningStatusPage';

vi.mock('../api/hazardReports', () => ({ getStats: vi.fn() }));
vi.mock('../api/hazardWarnings', async () => {
  const actual = await vi.importActual<typeof import('../api/hazardWarnings')>(
    '../api/hazardWarnings',
  );
  return {
    ...actual,
    getWarning: vi.fn(),
    retryWarning: vi.fn(),
    cancelWarning: vi.fn(),
  };
});

const ID = '6700aa77bcf86cd799439011';
const partial = warningDetail({
  status: 'PARTIALLY_DISSEMINATED',
  channels: [
    {
      channel: 'PUSH',
      state: 'SENT',
      recipients: 10,
      delivered: 10,
      attempts: 1,
    },
    {
      channel: 'SMS',
      state: 'FAILED',
      recipients: 0,
      delivered: 0,
      attempts: 1,
      lastError: 'SMS gateway is unavailable',
    },
    {
      channel: 'AUDIBLE',
      state: 'SENT',
      recipients: 1,
      delivered: 1,
      attempts: 1,
    },
  ],
});

function renderStatus(state?: unknown) {
  return renderPage(<WarningStatusPage />, {
    at: { pathname: `/warnings/${ID}`, state },
    path: '/warnings/:id',
  });
}

describe('WarningStatusPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getStats).mockResolvedValue(stats);
    vi.mocked(getWarning).mockReset().mockResolvedValue(warningDetail());
    vi.mocked(retryWarning).mockReset().mockResolvedValue(warning());
    vi.mocked(cancelWarning)
      .mockReset()
      .mockResolvedValue(warning({ status: 'CANCELLED' }));
  });

  it('shows the three channel cards, activity and overview', async () => {
    renderStatus({ notice: 'Warning HW-2026-0007 issued.' });

    expect(
      await screen.findByRole('heading', { name: 'Dissemination Status' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Warning HW-2026-0007 issued.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Push Notification' }),
    ).toHaveTextContent('1,245');
    expect(screen.getByRole('region', { name: 'SMS' })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Audible Alert' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Live Delivery Activity' }),
    ).toHaveTextContent('Push notification delivered to 1245 citizens');
    expect(
      screen.getByRole('region', { name: 'Warning Overview' }),
    ).toHaveTextContent('312');
    expect(screen.getByText('3 of 3 channels finished')).toBeInTheDocument();
  });

  it('flags a partial dissemination and retries the failed channel', async () => {
    vi.mocked(getWarning)
      .mockResolvedValueOnce(partial)
      .mockResolvedValue(warningDetail());
    renderStatus();

    expect(
      await screen.findByText(/Some channels could not deliver this warning/),
    ).toBeInTheDocument();
    const sms = screen.getByRole('region', { name: 'SMS' });
    expect(sms).toHaveTextContent('SMS gateway is unavailable');

    await userEvent.click(
      within(sms).getByRole('button', { name: 'Retry SMS' }),
    );

    expect(retryWarning).toHaveBeenCalledWith(ID);
    await waitFor(() =>
      expect(
        screen.queryByText(/Some channels could not deliver/),
      ).not.toBeInTheDocument(),
    );
  });

  it('explains pending dissemination', async () => {
    vi.mocked(getWarning).mockResolvedValue({
      ...partial,
      status: 'PENDING_DISSEMINATION',
    });
    renderStatus();
    expect(
      await screen.findByText(
        /Notification service is temporarily unavailable/,
      ),
    ).toBeInTheDocument();
  });

  it('needs a reason to cancel, then shows the All Clear', async () => {
    vi.mocked(getWarning)
      .mockResolvedValueOnce(warningDetail())
      .mockResolvedValue(
        warningDetail({
          status: 'CANCELLED',
          active: false,
          cancellation: {
            cancelledAt: NOW.toISOString(),
            cancelledBy: 'Officer Silva',
            reason: 'Water has receded',
          },
        }),
      );
    renderStatus();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel Warning' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Cancel this warning?' });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Send All Clear' }),
    );
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Give a reason of at least 5 characters.',
    );
    expect(cancelWarning).not.toHaveBeenCalled();

    await userEvent.type(
      within(dialog).getByLabelText(/Reason/),
      'Water has receded',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Send All Clear' }),
    );

    await waitFor(() =>
      expect(cancelWarning).toHaveBeenCalledWith(ID, {
        reason: 'Water has receded',
      }),
    );
    expect(
      await screen.findByText(/Cancelled by Officer Silva/),
    ).toHaveTextContent('Water has receded');
    expect(
      screen.queryByRole('button', { name: 'Cancel Warning' }),
    ).not.toBeInTheDocument();
  });

  it('shows the current state when another officer acted first', async () => {
    vi.mocked(retryWarning).mockRejectedValue(
      new ApiError(409, 'There is nothing to retry for this warning'),
    );
    vi.mocked(getWarning).mockResolvedValue(partial);
    renderStatus();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Retry SMS' }),
    );
    expect(
      await screen.findByText('There is nothing to retry for this warning'),
    ).toBeInTheDocument();
  });

  it('polls while the warning is still being sent', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(getWarning).mockResolvedValue({
      ...warningDetail(),
      status: 'DISSEMINATING',
      updatedAt: NOW.toISOString(),
    });
    renderStatus();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const calls = vi.mocked(getWarning).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(vi.mocked(getWarning).mock.calls.length).toBeGreaterThan(calls);
    vi.useRealTimers();
  });

  it('offers neither Retry nor Cancel once the warning has expired', async () => {
    vi.mocked(getWarning).mockResolvedValue({ ...partial, active: false });
    renderStatus();

    expect(await screen.findByText(/This warning expired/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Retry/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel Warning' }),
    ).not.toBeInTheDocument();
  });

  it('offers Retry for a send that was interrupted', async () => {
    vi.mocked(getWarning).mockResolvedValue({
      ...warningDetail(),
      status: 'DISSEMINATING',
      updatedAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
      channels: [
        {
          channel: 'PUSH',
          state: 'PENDING',
          recipients: 0,
          delivered: 0,
          attempts: 0,
        },
        {
          channel: 'SMS',
          state: 'PENDING',
          recipients: 0,
          delivered: 0,
          attempts: 0,
        },
        {
          channel: 'AUDIBLE',
          state: 'PENDING',
          recipients: 0,
          delivered: 0,
          attempts: 0,
        },
      ],
    });
    renderStatus();

    expect(
      await screen.findByText(/may have been interrupted/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry sending' }),
    );
    expect(retryWarning).toHaveBeenCalledWith(ID);
  });

  it('points a draft to its editor and says when a warning expired', async () => {
    vi.mocked(getWarning).mockResolvedValueOnce({
      ...warningDetail(),
      status: 'DRAFT',
      active: false,
      channels: [],
    });
    const { unmount } = renderStatus();
    expect(
      await screen.findByRole('link', { name: 'Edit draft' }),
    ).toHaveAttribute('href', `/warnings/${ID}/edit`);
    unmount();

    vi.mocked(getWarning).mockResolvedValueOnce({
      ...warningDetail(),
      active: false,
    });
    renderStatus();
    expect(await screen.findByText(/This warning expired/)).toBeInTheDocument();
  });

  it('shows not found', async () => {
    vi.mocked(getWarning).mockRejectedValue(
      new ApiError(404, 'Warning not found'),
    );
    renderStatus();
    expect(
      await screen.findByText('This warning could not be found.'),
    ).toBeInTheDocument();
  });
});
