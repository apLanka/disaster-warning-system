import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import {
  getReport,
  getStats,
  rejectReport,
  verifyReport,
} from '../api/hazardReports';
import {
  decidedReport,
  minutesAgo,
  NOW,
  report,
  stats,
} from '../test/fixtures';
import { renderPage } from '../test/render';
import { ReviewReportPage } from './ReviewReportPage';

vi.mock('../api/hazardReports', () => ({
  getReport: vi.fn(),
  getStats: vi.fn(),
  verifyReport: vi.fn(),
  rejectReport: vi.fn(),
}));
vi.mock('../components/reports/LocationMap', () => ({
  LocationMap: ({ location }: { location: { latitude: number } }) => (
    <div>map at {location.latitude}</div>
  ),
}));

const ID = '665f1f77bcf86cd799439011';

function renderReview() {
  return renderPage(<ReviewReportPage />, {
    at: `/reports/${ID}`,
    path: '/reports/:id',
    pendingStub: true,
  });
}

describe('ReviewReportPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getStats).mockReset().mockResolvedValue(stats);
    vi.mocked(getReport).mockReset().mockResolvedValue(report());
    vi.mocked(verifyReport).mockReset().mockResolvedValue(report());
    vi.mocked(rejectReport).mockReset().mockResolvedValue(report());
  });

  it('shows placeholders while the report loads', () => {
    vi.mocked(getReport).mockReturnValue(new Promise(() => undefined));

    renderReview();

    expect(
      screen.getByRole('status', { name: 'Loading report' }),
    ).toBeInTheDocument();
  });

  it('lays out the report for review', async () => {
    renderReview();

    expect(
      await screen.findByRole('heading', { name: 'Review Hazard Report' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Pending Verification').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText('HR-2026-0412')).toBeInTheDocument();
    expect(screen.getByText(/Submitted 2 mins ago/)).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '1. Report Details' }),
    ).toHaveTextContent('Rising River Level');
    expect(
      screen.getByRole('region', { name: '1. Report Details' }),
    ).toHaveTextContent('Nimal Perera');
    expect(
      screen.getByRole('region', { name: '1. Report Details' }),
    ).toHaveTextContent('+94 77 123 4567');
    expect(
      screen.getByRole('region', { name: '2. Location' }),
    ).toHaveTextContent('map at 7.2906');
    expect(
      screen.getByRole('region', { name: '3. Photo Evidence' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '4. Officer Notes (Optional)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '5. Decision' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Carefully review the submitted details/),
    ).toBeInTheDocument();
  });

  it('links back to the pending list', async () => {
    renderReview();

    expect(
      await screen.findByRole('link', { name: /Back to pending reports/ }),
    ).toHaveAttribute('href', '/reports/pending');
  });

  it('copes with an anonymous reporter who gave no contact', async () => {
    vi.mocked(getReport).mockResolvedValue(
      report({ reporterName: undefined, reporterContact: undefined }),
    );

    renderReview();

    const details = await screen.findByRole('region', {
      name: '1. Report Details',
    });
    expect(details).toHaveTextContent('Anonymous citizen');
    expect(details).toHaveTextContent('Not provided');
  });

  it('shows the photo evidence', async () => {
    vi.mocked(getReport).mockResolvedValue(
      report({
        photos: [
          {
            publicId: 'p1',
            secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/p1.jpg',
            width: 1,
            height: 1,
            bytes: 1,
          },
        ],
      }),
    );

    renderReview();

    expect(
      await screen.findByRole('img', { name: 'Photo evidence 1 of 1' }),
    ).toBeInTheDocument();
  });

  it('shows a verified report read-only, with no way to decide again', async () => {
    vi.mocked(getReport).mockResolvedValue(decidedReport('VERIFIED'));

    renderReview();

    expect(
      await screen.findByRole('region', { name: 'Decision' }),
    ).toHaveTextContent('Officer Silva');
    expect(
      screen.queryByRole('button', { name: 'Verify report' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reject report' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: /Officer Notes/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Carefully review/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Back to verified reports/ }),
    ).toHaveAttribute('href', '/reports/verified');
  });

  it('shows a rejected report with its reason, linking back to the rejected list', async () => {
    vi.mocked(getReport).mockResolvedValue(decidedReport('REJECTED'));

    renderReview();

    expect(
      await screen.findByText('Insufficient information'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Back to rejected reports/ }),
    ).toHaveAttribute('href', '/reports/rejected');
  });

  it('says so, with a way back, when the report does not exist', async () => {
    vi.mocked(getReport).mockRejectedValue(
      new ApiError(404, 'Report not found'),
    );

    renderReview();

    expect(await screen.findByText('Report not found')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to pending reports' }),
    ).toBeInTheDocument();
  });

  it('shows an error with Retry for any other failure, then recovers', async () => {
    vi.mocked(getReport).mockRejectedValueOnce(new ApiError(500, 'boom'));

    renderReview();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The server hit a problem',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('heading', { name: 'Review Hazard Report' }),
    ).toBeInTheDocument();
  });

  it('sends the officer notes with the verification, then returns to the list and refreshes the counts', async () => {
    renderReview();
    await screen.findByRole('heading', { name: 'Review Hazard Report' });
    const statCalls = vi.mocked(getStats).mock.calls.length;

    await userEvent.type(screen.getByLabelText('Notes'), 'Matches the gauge');
    await userEvent.click(
      screen.getByRole('button', { name: 'Verify report' }),
    );

    expect(verifyReport).toHaveBeenCalledWith(ID, {
      notes: 'Matches the gauge',
    });
    expect(await screen.findByText('Pending list page')).toBeInTheDocument();
    expect(getStats).toHaveBeenCalledTimes(statCalls + 1);
  });

  it('rejects through the confirmation dialog and sends the notes too', async () => {
    renderReview();
    await screen.findByRole('heading', { name: 'Review Hazard Report' });

    await userEvent.type(screen.getByLabelText('Notes'), 'Looks vague');
    await userEvent.selectOptions(
      screen.getByLabelText(/Rejection reason/),
      'INSUFFICIENT_INFORMATION',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reject report' }),
    );
    await userEvent.click(
      screen.getByRole('dialog').querySelector('button:last-child')!,
    );

    await waitFor(() =>
      expect(rejectReport).toHaveBeenCalledWith(ID, {
        reason: 'INSUFFICIENT_INFORMATION',
        details: undefined,
        notes: 'Looks vague',
      }),
    );
    expect(await screen.findByText('Pending list page')).toBeInTheDocument();
  });

  it('shows the real state when another officer decided first', async () => {
    vi.mocked(verifyReport).mockRejectedValue(
      new ApiError(409, 'Already reviewed'),
    );
    renderReview();
    await screen.findByRole('heading', { name: 'Review Hazard Report' });
    vi.mocked(getReport).mockResolvedValue(
      decidedReport('REJECTED', { createdAt: minutesAgo(3) }),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Verify report' }),
    );

    expect(
      await screen.findByText(/already reviewed by another officer/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Insufficient information'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Verify report' }),
    ).not.toBeInTheDocument();
    expect(getReport).toHaveBeenCalledTimes(2);
  });
  it('offers to issue a warning from a verified report only', async () => {
    vi.mocked(getReport).mockResolvedValue(decidedReport('VERIFIED'));
    renderReview();

    expect(
      await screen.findByRole('link', {
        name: 'Issue Warning from this report',
      }),
    ).toHaveAttribute('href', `/warnings/new?fromReport=${ID}`);
  });

  it('does not offer a warning for a rejected report', async () => {
    vi.mocked(getReport).mockResolvedValue(decidedReport('REJECTED'));
    renderReview();

    await screen.findByRole('heading', { name: 'Review Hazard Report' });
    expect(
      screen.queryByRole('link', { name: 'Issue Warning from this report' }),
    ).not.toBeInTheDocument();
  });
});
