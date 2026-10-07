import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStats } from '../api/hazardReports';
import {
  createWarning,
  issueDraft,
  previewWarning,
  updateDraft,
} from '../api/hazardWarnings';
import { ApiError, NetworkError } from '../api/client';
import { preview, stats, warning } from '../test/fixtures';
import { renderPage } from '../test/render';
import { emptyForm, type WarningReviewState } from '../lib/warningForm';
import { ReviewWarningPage } from './ReviewWarningPage';

vi.mock('../api/hazardReports', () => ({ getStats: vi.fn() }));
vi.mock('../api/hazardWarnings', async () => {
  const actual = await vi.importActual<typeof import('../api/hazardWarnings')>(
    '../api/hazardWarnings',
  );
  return {
    ...actual,
    previewWarning: vi.fn(),
    createWarning: vi.fn(),
    issueDraft: vi.fn(),
    updateDraft: vi.fn(),
  };
});

function Landing() {
  const location = useLocation();
  return (
    <pre data-testid="landing">
      {JSON.stringify({ path: location.pathname, state: location.state })}
    </pre>
  );
}

const state: WarningReviewState = {
  clientRequestId: '7b0e6c0e-0f5e-4a52-9a77-3d3a0c1f9a11',
  form: {
    ...emptyForm(new Date('2026-10-07T08:00:00Z')),
    hazardType: 'FLOOD',
    level: 'HIGH',
    description: 'Heavy rainfall expected in low-lying areas',
    safetyInstructions: ['Move to higher ground'],
    districts: ['COLOMBO'],
    validUntil: '2099-01-01T08:00',
  },
};

function renderReview(withState: WarningReviewState | null = state) {
  return renderPage(
    <Routes>
      <Route path="/warnings/review" element={<ReviewWarningPage />} />
      <Route path="*" element={<Landing />} />
    </Routes>,
    { at: { pathname: '/warnings/review', state: withState } },
  );
}

const landing = () =>
  JSON.parse(screen.getByTestId('landing').textContent ?? '{}');

describe('ReviewWarningPage', () => {
  beforeEach(() => {
    vi.mocked(getStats).mockResolvedValue(stats);
    vi.mocked(previewWarning).mockReset().mockResolvedValue(preview());
    vi.mocked(createWarning)
      .mockReset()
      .mockResolvedValue(warning({ id: 'w7' }));
    vi.mocked(issueDraft)
      .mockReset()
      .mockResolvedValue(warning({ id: 'w9' }));
    vi.mocked(updateDraft)
      .mockReset()
      .mockResolvedValue(warning({ id: 'w9', status: 'DRAFT' }));
  });

  it('redirects to the form when opened directly', async () => {
    renderReview(null);
    await waitFor(() => expect(landing().path).toBe('/warnings/new'));
  });

  it('shows the summary and the number of citizens who will receive it', async () => {
    renderReview();

    expect(
      await screen.findByRole('heading', { name: 'Review Warning' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Warning Summary' }),
    ).toHaveTextContent('Flood');
    expect(await screen.findByText('4,325')).toBeInTheDocument();
    expect(screen.getByText(/2,100 can also receive SMS/)).toBeInTheDocument();
    expect(screen.getByText('Move to higher ground')).toBeInTheDocument();
  });

  it('warns when nobody is registered in the area but still allows issuing', async () => {
    vi.mocked(previewWarning).mockResolvedValue(
      preview({
        recipients: { total: 0, withPhone: 0, byDistrict: { COLOMBO: 0 } },
      }),
    );
    renderReview();

    expect(
      await screen.findByText(
        'No registered recipients found for the selected area.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm Warning' }),
    ).toBeEnabled();
  });

  it('needs "issue anyway" when an active warning already covers the area', async () => {
    vi.mocked(previewWarning).mockResolvedValue(
      preview({
        duplicates: [warning({ id: 'w1', reference: 'HW-2026-0001' })],
      }),
    );
    renderReview();

    expect(
      await screen.findByRole('link', { name: 'HW-2026-0001' }),
    ).toHaveAttribute('href', '/warnings/w1');
    const confirm = screen.getByRole('button', { name: 'Confirm Warning' });
    expect(confirm).toBeDisabled();

    await userEvent.click(
      screen.getByRole('checkbox', { name: /Issue anyway/ }),
    );
    await userEvent.click(confirm);
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Issue warning',
      }),
    );

    await waitFor(() =>
      expect(createWarning).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ISSUE', force: true }),
      ),
    );
  });

  it('confirms twice, then opens the status page', async () => {
    renderReview();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm Warning' }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Issue this warning?',
    });
    expect(dialog).toHaveTextContent('cannot be recalled');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Issue warning' }),
    );

    await waitFor(() => expect(landing().path).toBe('/warnings/w7'));
    expect(createWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRequestId: state.clientRequestId,
        action: 'ISSUE',
        force: false,
        districts: ['COLOMBO'],
      }),
    );
    expect(landing().state.notice).toBe('Warning HW-2026-0007 issued.');
  });

  it('saves the reviewed edits onto the draft, then issues it', async () => {
    renderReview({ ...state, draftId: 'w9' });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm Warning' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Issue warning',
      }),
    );

    await waitFor(() =>
      expect(issueDraft).toHaveBeenCalledWith('w9', { force: false }),
    );
    // What the officer reviewed is what gets issued.
    expect(updateDraft).toHaveBeenCalledWith(
      'w9',
      expect.objectContaining({
        level: 'HIGH',
        districts: ['COLOMBO'],
        description: 'Heavy rainfall expected in low-lying areas',
      }),
    );
    expect(vi.mocked(updateDraft).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(issueDraft).mock.invocationCallOrder[0]!,
    );
  });

  it('shows the duplicate choice when another officer issued an overlapping warning meanwhile', async () => {
    vi.mocked(previewWarning)
      .mockResolvedValueOnce(preview())
      .mockResolvedValue(
        preview({
          duplicates: [warning({ id: 'w1', reference: 'HW-2026-0001' })],
        }),
      );
    vi.mocked(createWarning).mockRejectedValueOnce(
      new ApiError(
        409,
        'An active HIGH Flood warning (HW-2026-0001) already covers Colombo.',
      ),
    );
    renderReview();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm Warning' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Issue warning',
      }),
    );

    expect(
      await screen.findByText(/already covers Colombo/),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('checkbox', { name: /Issue anyway/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm Warning' }),
    ).toBeDisabled();
  });

  it('keeps everything on screen when the connection drops', async () => {
    vi.mocked(createWarning).mockRejectedValue(new NetworkError());
    renderReview();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm Warning' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Issue warning',
      }),
    );

    expect(
      await screen.findByText(/Cannot reach the server/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Warning Summary' }),
    ).toBeInTheDocument();
  });

  it('Back keeps entries', async () => {
    renderReview();
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(landing().path).toBe('/warnings/new');
    expect(landing().state).toEqual({
      form: state.form,
      clientRequestId: state.clientRequestId,
    });
  });

  it('Cancel asks before discarding', async () => {
    renderReview();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel' }),
    );
    await userEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Discard this warning?' }),
      ).getByRole('button', { name: 'Discard' }),
    );

    expect(landing().path).toBe('/warnings');
  });

  it('offers a retry when the preview fails', async () => {
    vi.mocked(previewWarning).mockRejectedValueOnce(new NetworkError());
    renderReview();

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('4,325')).toBeInTheDocument();
  });
});
