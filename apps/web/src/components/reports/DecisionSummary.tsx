import { REJECTION_REASON_LABELS, type HazardReportDto } from '@repo/types';

import { formatIncidentTime } from '../../lib/format';
import { StatusChip } from '../ui/StatusChip';

/** Read-only outcome for a report that has already been decided. */
export function DecisionSummary({
  report,
  now,
}: {
  report: HazardReportDto;
  now: Date;
}) {
  const { decision } = report;

  return (
    <div className="space-y-3 text-sm">
      <StatusChip status={report.status} />
      {decision ? (
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
          <dt className="text-muted">Decided</dt>
          <dd>{formatIncidentTime(decision.decidedAt, now)}</dd>
          {decision.decidedBy && (
            <>
              <dt className="text-muted">Officer</dt>
              <dd>{decision.decidedBy}</dd>
            </>
          )}
          {decision.rejectionReason && (
            <>
              <dt className="text-muted">Reason</dt>
              <dd>{REJECTION_REASON_LABELS[decision.rejectionReason]}</dd>
            </>
          )}
          {decision.rejectionDetails && (
            <>
              <dt className="text-muted">Details</dt>
              <dd>{decision.rejectionDetails}</dd>
            </>
          )}
          {decision.officerNotes && (
            <>
              <dt className="text-muted">Officer notes</dt>
              <dd>{decision.officerNotes}</dd>
            </>
          )}
        </dl>
      ) : null}
    </div>
  );
}
