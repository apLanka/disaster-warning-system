import type { ReactNode } from 'react';

import type { StatTone } from '../ui/StatCard';

const TONE_CLASSES: Record<StatTone, string> = {
  warning: 'bg-orange-tint text-orange',
  success: 'bg-success-tint text-success',
  danger: 'bg-danger-tint text-danger',
  neutral: 'bg-neutral-tint text-muted',
};

interface KpiCardProps {
  label: string;
  value: string;
  /** A second line under the label, for example when the peak happened. */
  detail?: string;
  icon: ReactNode;
  tone: StatTone;
}

/** A headline figure for the report. Unlike StatCard the value is already formatted text. */
export function KpiCard({ label, value, detail, icon, tone }: KpiCardProps) {
  return (
    <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-xl border p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-muted text-sm">{label}</p>
        {detail && <p className="text-muted text-xs">{detail}</p>}
      </div>
      <span
        aria-hidden="true"
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[tone]}`}
      >
        {icon}
      </span>
    </div>
  );
}
