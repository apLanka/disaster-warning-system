import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export type BannerTone = 'warning' | 'danger' | 'success';

const TONES: Record<BannerTone, { classes: string; icon: ReactNode }> = {
  warning: {
    classes: 'bg-warning-tint text-warning-text',
    icon: <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />,
  },
  danger: {
    classes: 'bg-danger-tint text-danger',
    icon: <XCircle aria-hidden="true" className="size-5 shrink-0" />,
  },
  success: {
    classes: 'bg-success-tint text-success',
    icon: <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />,
  },
};

interface BannerProps {
  tone: BannerTone;
  children: ReactNode;
  /** Shown to the right, e.g. a Retry button or a link. */
  action?: ReactNode;
}

export function Banner({ tone, children, action }: BannerProps) {
  const { classes, icon } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex items-center gap-3 rounded-lg p-3 text-sm ${classes}`}
    >
      {icon}
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}
