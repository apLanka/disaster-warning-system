import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  HAZARD_TYPE_LABELS,
  REJECTION_REASON_LABELS,
  type HazardReportDto,
} from '@repo/types';

import {
  formatCoordinates,
  formatRelativeTime,
  isStale,
  STALE_AFTER_MINUTES,
} from '../../lib/format';
import { StatusChip } from '../ui/StatusChip';

interface ReportsTableProps {
  reports: HazardReportDto[];
  /** Number of the first row, so numbering continues across pages. */
  firstRow: number;
  /** Decided lists show the outcome; the pending list highlights how long reports have waited. */
  mode: 'pending' | 'decided';
  /** Passed in (see useNow) so rendering stays pure and tests can fix the clock. */
  now: Date;
}

const HEAD =
  'text-muted px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase';

export function ReportsTable({
  reports,
  firstRow,
  mode,
  now,
}: ReportsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="bg-page">
          <tr>
            <th scope="col" className={HEAD}>
              #
            </th>
            <th scope="col" className={HEAD}>
              Report ID
            </th>
            <th scope="col" className={HEAD}>
              Hazard type
            </th>
            <th scope="col" className={HEAD}>
              Location
            </th>
            <th scope="col" className={HEAD}>
              Submitted by
            </th>
            <th scope="col" className={HEAD}>
              {mode === 'pending' ? 'Time' : 'Decision'}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {reports.map((report, index) => (
            <tr key={report.id} className="hover:bg-page/60 h-14">
              <td className="text-muted px-4">{firstRow + index}</td>
              <td className="px-4 font-mono whitespace-nowrap">
                {report.reference}
              </td>
              <td className="px-4">{HAZARD_TYPE_LABELS[report.type]}</td>
              <td className="px-4 font-mono text-xs whitespace-nowrap">
                {formatCoordinates(report.location)}
              </td>
              <td className="px-4">
                {report.reporterName ?? 'Anonymous citizen'}
              </td>
              <td className="px-4">
                {mode === 'pending' ? (
                  <WaitingTime iso={report.createdAt} now={now} />
                ) : (
                  <Outcome report={report} now={now} />
                )}
              </td>
              <td className="px-4 text-right">
                <Link
                  to={`/reports/${report.id}`}
                  aria-label={`View report ${report.reference}`}
                  className="bg-orange-tint text-orange rounded-lg px-3 py-1.5 text-xs font-semibold hover:opacity-80"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WaitingTime({ iso, now }: { iso: string; now: Date }) {
  const text = formatRelativeTime(iso, now);
  if (!isStale(iso, now)) return <span className="text-muted">{text}</span>;

  return (
    <span className="bg-warning-tint text-warning-text inline-flex items-center gap-1 rounded px-2 py-1 font-semibold">
      <Clock aria-hidden="true" className="size-3.5" />
      {text}
      <span className="sr-only">
        {' '}
        (waiting more than {STALE_AFTER_MINUTES} minutes)
      </span>
    </span>
  );
}

function Outcome({ report, now }: { report: HazardReportDto; now: Date }) {
  const { decision } = report;
  return (
    <div className="space-y-1">
      <StatusChip status={report.status} />
      {decision && (
        <p className="text-muted text-xs">
          {formatRelativeTime(decision.decidedAt, now)}
          {decision.rejectionReason &&
            ` · ${REJECTION_REASON_LABELS[decision.rejectionReason]}`}
        </p>
      )}
    </div>
  );
}
