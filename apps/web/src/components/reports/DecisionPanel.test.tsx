import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError } from '../../api/client';
import { rejectReport, verifyReport } from '../../api/hazardReports';
import { report } from '../../test/fixtures';
import { DecisionPanel } from './DecisionPanel';

vi.mock('../../api/hazardReports', () => ({
  verifyReport: vi.fn(),
  rejectReport: vi.fn(),
}));

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(notes = '') {
  const onDecided = vi.fn();
  const onConflict = vi.fn();
  render(
    <DecisionPanel
      report={report()}
      notes={notes}
      onDecided={onDecided}
      onConflict={onConflict}
    />,
  );
  return { onDecided, onConflict };
}

const verifyButton = () =>
  screen.getByRole('button', { name: 'Verify report' });
const rejectButton = () =>
  screen.getByRole('button', { name: 'Reject report' });
const reasonSelect = () => screen.getByLabelText(/Rejection reason/);
const detailsBox = () => screen.getByLabelText(/Details/);

describe('DecisionPanel', () => {
  beforeEach(() => {
    vi.mocked(verifyReport).mockReset().mockResolvedValue(report());
    vi.mocked(rejectReport).mockReset().mockResolvedValue(report());
  });

  describe('verify', () => {
    it('verifies the report and reports the outcome', async () => {
      const { onDecided } = setup();

      await userEvent.click(verifyButton());

      expect(verifyReport).toHaveBeenCalledWith('665f1f77bcf86cd799439011', {
        notes: undefined,
      });
      await waitFor(() =>
        expect(onDecided).toHaveBeenCalledWith(
          'Report HR-2026-0412 verified. The reporter has been notified.',
        ),
      );
    });

    it('sends the officer notes, trimmed', async () => {
      setup('  Matches the gauge  ');

      await userEvent.click(verifyButton());

      expect(verifyReport).toHaveBeenCalledWith(expect.any(String), {
        notes: 'Matches the gauge',
      });
    });

    it('treats blank notes as no notes', async () => {
      setup('   ');

      await userEvent.click(verifyButton());

      expect(verifyReport).toHaveBeenCalledWith(expect.any(String), {
        notes: undefined,
      });
    });

    it('blocks a second click and the reject button while the request is in flight', async () => {
      const request = deferred();
      vi.mocked(verifyReport).mockReturnValue(request.promise as never);
      setup();

      await userEvent.click(verifyButton());
      await userEvent.click(verifyButton());

      expect(verifyReport).toHaveBeenCalledOnce();
      expect(verifyButton()).toBeDisabled();
      expect(rejectButton()).toBeDisabled();
      request.resolve();
    });

    it('shows a plain-language error and lets the officer try again', async () => {
      vi.mocked(verifyReport).mockRejectedValueOnce(new ApiError(500, 'boom'));
      const { onDecided } = setup();

      await userEvent.click(verifyButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The server hit a problem',
      );
      expect(onDecided).not.toHaveBeenCalled();
      expect(verifyButton()).toBeEnabled();

      await userEvent.click(verifyButton());
      await waitFor(() => expect(onDecided).toHaveBeenCalled());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says when the server cannot be reached', async () => {
      vi.mocked(verifyReport).mockRejectedValue(new NetworkError());
      setup();

      await userEvent.click(verifyButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Cannot reach the server',
      );
    });

    it('hands over to the page when someone else decided first', async () => {
      vi.mocked(verifyReport).mockRejectedValue(
        new ApiError(409, 'Already reviewed'),
      );
      const { onConflict, onDecided } = setup();

      await userEvent.click(verifyButton());

      await waitFor(() => expect(onConflict).toHaveBeenCalledOnce());
      expect(onDecided).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('reject', () => {
    it('offers every rejection reason', () => {
      setup();

      const options = Array.from(reasonSelect().querySelectorAll('option')).map(
        (option) => option.textContent,
      );
      expect(options).toEqual([
        'Select reason…',
        'Duplicate of an existing report',
        'Insufficient information',
        'Could not be verified',
        'Outside the monitored area',
        'Other',
      ]);
    });

    it('refuses to reject without a reason, and points at the field', async () => {
      setup();

      await userEvent.click(rejectButton());

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Choose a reason for rejecting this report.',
      );
      expect(reasonSelect()).toHaveFocus();
      expect(reasonSelect()).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(rejectReport).not.toHaveBeenCalled();
    });

    it('requires details when the reason is "Other"', async () => {
      setup();
      await userEvent.selectOptions(reasonSelect(), 'OTHER');

      expect(screen.getByText(/Required for "Other"/)).toBeInTheDocument();
      await userEvent.click(rejectButton());

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Add details so the reporter knows why.',
      );
      expect(detailsBox()).toHaveFocus();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not accept blank details for "Other"', async () => {
      setup();
      await userEvent.selectOptions(reasonSelect(), 'OTHER');
      await userEvent.type(detailsBox(), '    ');

      await userEvent.click(rejectButton());

      expect(screen.getByRole('alert')).toHaveTextContent('Add details');
    });

    it('does not require details for the other reasons', async () => {
      setup();
      await userEvent.selectOptions(reasonSelect(), 'DUPLICATE');

      await userEvent.click(rejectButton());

      expect(
        screen.getByRole('dialog', { name: 'Reject this report?' }),
      ).toBeInTheDocument();
    });

    it('clears the error once the officer starts fixing it', async () => {
      setup();
      await userEvent.click(rejectButton());
      expect(screen.getByRole('alert')).toBeInTheDocument();

      await userEvent.selectOptions(reasonSelect(), 'DUPLICATE');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('asks for confirmation naming the report and the consequence', async () => {
      setup();
      await userEvent.selectOptions(reasonSelect(), 'UNVERIFIABLE');

      await userEvent.click(rejectButton());

      const dialog = screen.getByRole('dialog', {
        name: 'Reject this report?',
      });
      expect(dialog).toHaveTextContent('HR-2026-0412');
      expect(dialog).toHaveTextContent('cannot be undone');
      expect(rejectReport).not.toHaveBeenCalled();
    });

    it('does nothing when the officer cancels', async () => {
      setup();
      await userEvent.selectOptions(reasonSelect(), 'UNVERIFIABLE');
      await userEvent.click(rejectButton());

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(rejectReport).not.toHaveBeenCalled();
    });

    it('rejects with the reason, trimmed details and notes once confirmed', async () => {
      const { onDecided } = setup('Checked the map');
      await userEvent.selectOptions(reasonSelect(), 'OTHER');
      await userEvent.type(detailsBox(), '  Photo shows a different place ');
      await userEvent.click(rejectButton());

      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Reject report',
        }),
      );

      expect(rejectReport).toHaveBeenCalledWith('665f1f77bcf86cd799439011', {
        reason: 'OTHER',
        details: 'Photo shows a different place',
        notes: 'Checked the map',
      });
      await waitFor(() =>
        expect(onDecided).toHaveBeenCalledWith(
          'Report HR-2026-0412 rejected. The reporter has been told why.',
        ),
      );
    });

    it('omits empty details', async () => {
      setup();
      await userEvent.selectOptions(reasonSelect(), 'DUPLICATE');
      await userEvent.click(rejectButton());

      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Reject report',
        }),
      );

      expect(rejectReport).toHaveBeenCalledWith(expect.any(String), {
        reason: 'DUPLICATE',
        details: undefined,
        notes: undefined,
      });
    });

    it('closes the dialog and shows the error when the request fails', async () => {
      vi.mocked(rejectReport).mockRejectedValue(new ApiError(500, 'boom'));
      setup();
      await userEvent.selectOptions(reasonSelect(), 'DUPLICATE');
      await userEvent.click(rejectButton());

      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Reject report',
        }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The server hit a problem',
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('hands over to the page when someone else decided first', async () => {
      vi.mocked(rejectReport).mockRejectedValue(
        new ApiError(409, 'Already reviewed'),
      );
      const { onConflict } = setup();
      await userEvent.selectOptions(reasonSelect(), 'DUPLICATE');
      await userEvent.click(rejectButton());

      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Reject report',
        }),
      );

      await waitFor(() => expect(onConflict).toHaveBeenCalledOnce());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('cannot be dismissed or repeated while rejecting', async () => {
      const request = deferred();
      vi.mocked(rejectReport).mockReturnValue(request.promise as never);
      setup();
      await userEvent.selectOptions(reasonSelect(), 'DUPLICATE');
      await userEvent.click(rejectButton());
      const dialog = screen.getByRole('dialog');

      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Reject report' }),
      );
      await userEvent.keyboard('{Escape}');

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(rejectReport).toHaveBeenCalledOnce();
      request.resolve();
    });
  });
});
