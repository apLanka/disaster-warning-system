import { REPORT_STATUS_LABELS, type ReportStatus } from '@repo/types';

// One chip for every screen: colour and label never vary (style guide 5.3).
const STATUS_CLASSES: Record<ReportStatus, string> = {
  PENDING_SYNC: 'bg-neutral-tint text-muted',
  PENDING_VERIFICATION: 'bg-warning-tint text-warning-text',
  VERIFIED: 'bg-success-tint text-success',
  REJECTED: 'bg-danger-tint text-danger',
};

export function StatusChip({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {REPORT_STATUS_LABELS[status]}
    </span>
  );
}
