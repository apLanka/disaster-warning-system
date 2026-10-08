import {
  WARNING_STATUS_LABELS,
  type HazardWarningDto,
  type WarningStatus,
} from '@repo/types';

const STATUS_CLASSES: Record<WarningStatus, string> = {
  DRAFT: 'bg-neutral-tint text-muted',
  DISSEMINATING: 'bg-warning-tint text-warning-text',
  DISSEMINATED: 'bg-success-tint text-success',
  PARTIALLY_DISSEMINATED: 'bg-warning-tint text-warning-text',
  PENDING_DISSEMINATION: 'bg-danger-tint text-danger',
  CANCELLED: 'bg-neutral-tint text-muted',
};

const ISSUED: WarningStatus[] = [
  'DISSEMINATING',
  'DISSEMINATED',
  'PARTIALLY_DISSEMINATED',
  'PENDING_DISSEMINATION',
];

/** Status with a dot, plus "Expired" for an issued warning whose period is over. */
export function WarningStatusChip({
  warning,
}: {
  warning: Pick<HazardWarningDto, 'status' | 'active'>;
}) {
  const expired = ISSUED.includes(warning.status) && !warning.active;
  const classes = expired
    ? STATUS_CLASSES.CANCELLED
    : STATUS_CLASSES[warning.status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {expired ? 'Expired' : WARNING_STATUS_LABELS[warning.status]}
    </span>
  );
}
