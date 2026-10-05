import type { ReactNode } from 'react';

export type StatTone = 'warning' | 'success' | 'danger' | 'neutral';

const TONE_CLASSES: Record<StatTone, string> = {
  warning: 'bg-orange-tint text-orange',
  success: 'bg-success-tint text-success',
  danger: 'bg-danger-tint text-danger',
  neutral: 'bg-neutral-tint text-muted',
};

interface StatCardProps {
  label: string;
  /** Undefined while the number is still loading. */
  value: number | undefined;
  icon: ReactNode;
  tone: StatTone;
}

export function StatCard({ label, value, icon, tone }: StatCardProps) {
  return (
    <div className="border-border bg-surface flex items-center justify-between rounded-xl border p-4 shadow-sm">
      <div>
        <p className="text-3xl font-bold" aria-live="polite">
          {value ?? '–'}
        </p>
        <p className="text-muted text-sm">{label}</p>
      </div>
      <span
        aria-hidden="true"
        className={`flex size-10 items-center justify-center rounded-lg ${TONE_CLASSES[tone]}`}
      >
        {icon}
      </span>
    </div>
  );
}
