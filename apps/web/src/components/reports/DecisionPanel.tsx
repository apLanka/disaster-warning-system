import { CircleCheck, CircleX } from 'lucide-react';
import { useRef, useState } from 'react';

import {
  HAZARD_REPORT_LIMITS,
  REJECTION_REASON_LABELS,
  REJECTION_REASONS,
  type HazardReportDto,
  type RejectionReason,
} from '@repo/types';

import { describeError, isConflict } from '../../api/client';
import { rejectReport, verifyReport } from '../../api/hazardReports';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field, INPUT_CLASSES } from '../ui/Field';

interface DecisionPanelProps {
  report: HazardReportDto;
  /** Internal note typed in the Officer Notes card. Never shown to the reporter. */
  notes: string;
  /** Called after a decision is stored, with a message for the officer. */
  onDecided: (message: string) => void;
  /** Called when someone else decided first, so the page can show the real state. */
  onConflict: () => void;
}

type Action = 'verify' | 'reject';

export function DecisionPanel({
  report,
  notes,
  onDecided,
  onConflict,
}: DecisionPanelProps) {
  const [reason, setReason] = useState<RejectionReason | ''>('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState<{ reason?: string; details?: string }>(
    {},
  );
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const reasonRef = useRef<HTMLSelectElement>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);

  const busy = pending !== null;
  const internalNotes = notes.trim() === '' ? undefined : notes.trim();

  async function run(
    action: Action,
    send: () => Promise<unknown>,
    message: string,
  ) {
    setPending(action);
    setFailure(null);
    try {
      await send();
      onDecided(message);
    } catch (error) {
      setConfirming(false);
      if (isConflict(error)) onConflict();
      else setFailure(error);
    } finally {
      setPending(null);
    }
  }

  function verify() {
    return run(
      'verify',
      () => verifyReport(report.id, { notes: internalNotes }),
      `Report ${report.reference} verified. The reporter has been notified.`,
    );
  }

  /** Reject needs a reason, and details when the reason is "other". Check before asking to confirm. */
  function askToReject() {
    const next: { reason?: string; details?: string } = {};
    if (reason === '')
      next.reason = 'Choose a reason for rejecting this report.';
    else if (reason === 'OTHER' && details.trim() === '') {
      next.details = 'Add details so the reporter knows why.';
    }
    setErrors(next);

    if (next.reason) reasonRef.current?.focus();
    else if (next.details) detailsRef.current?.focus();
    else setConfirming(true);
  }

  function reject() {
    if (reason === '') return Promise.resolve();
    return run(
      'reject',
      () =>
        rejectReport(report.id, {
          reason,
          details: details.trim() === '' ? undefined : details.trim(),
          notes: internalNotes,
        }),
      `Report ${report.reference} rejected. The reporter has been told why.`,
    );
  }

  return (
    <div className="space-y-4">
      {failure !== null && (
        <Banner tone="danger">{describeError(failure)}</Banner>
      )}

      <Button
        variant="success"
        className="w-full"
        icon={<CircleCheck aria-hidden="true" className="size-4" />}
        loading={pending === 'verify'}
        disabled={busy}
        onClick={verify}
      >
        Verify report
      </Button>

      <div className="border-border space-y-3 border-t pt-4">
        <Field
          label="Rejection reason"
          htmlFor="reject-reason"
          required
          hint="Required to reject. The reporter is told this reason."
          error={errors.reason}
        >
          <select
            id="reject-reason"
            ref={reasonRef}
            className={INPUT_CLASSES}
            value={reason}
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={errors.reason ? 'reject-reason-error' : undefined}
            onChange={(event) => {
              setReason(event.target.value as RejectionReason | '');
              setErrors({});
            }}
          >
            <option value="">Select reason…</option>
            {REJECTION_REASONS.map((value) => (
              <option key={value} value={value}>
                {REJECTION_REASON_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Details"
          htmlFor="reject-details"
          required={reason === 'OTHER'}
          hint={
            reason === 'OTHER'
              ? 'Required for "Other". Shown to the reporter.'
              : 'Optional. Shown to the reporter.'
          }
          error={errors.details}
        >
          <textarea
            id="reject-details"
            ref={detailsRef}
            rows={3}
            maxLength={HAZARD_REPORT_LIMITS.notesMax}
            className={INPUT_CLASSES}
            value={details}
            aria-invalid={errors.details ? true : undefined}
            aria-describedby={
              errors.details ? 'reject-details-error' : undefined
            }
            onChange={(event) => {
              setDetails(event.target.value);
              setErrors({});
            }}
          />
        </Field>

        <Button
          variant="danger"
          className="w-full"
          icon={<CircleX aria-hidden="true" className="size-4" />}
          disabled={busy}
          onClick={askToReject}
        >
          Reject report
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Reject this report?"
        confirmLabel="Reject report"
        loading={pending === 'reject'}
        onConfirm={reject}
        onCancel={() => setConfirming(false)}
      >
        {report.reference} will be marked as rejected and the reporter will be
        told why. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
