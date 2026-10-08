import {
  Bell,
  MessageSquare,
  RotateCw,
  Siren,
  type LucideIcon,
} from 'lucide-react';

import {
  CHANNEL_LABELS,
  type ChannelKind,
  type ChannelState,
  type DisseminationStatusDto,
} from '@repo/types';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const ICONS: Record<ChannelKind, LucideIcon> = {
  PUSH: Bell,
  SMS: MessageSquare,
  AUDIBLE: Siren,
};
const STATE_TEXT: Record<ChannelState, { label: string; classes: string }> = {
  PENDING: { label: 'Sending…', classes: 'text-warning-text' },
  SENT: { label: 'Completed', classes: 'text-success' },
  FAILED: { label: 'Failed', classes: 'text-danger' },
  SKIPPED: { label: 'No recipients', classes: 'text-muted' },
};
const count = new Intl.NumberFormat('en-GB');

interface ChannelCardProps {
  status: DisseminationStatusDto;
  onRetry?: () => void;
  retrying?: boolean;
}

/** One channel's progress, as on the wireframe's three cards, with Retry when it failed. */
export function ChannelCard({
  status,
  onRetry,
  retrying = false,
}: ChannelCardProps) {
  const Icon = ICONS[status.channel];
  const label = CHANNEL_LABELS[status.channel];
  const state = STATE_TEXT[status.state];
  const percent =
    status.recipients === 0
      ? 0
      : Math.round((status.delivered / status.recipients) * 100);

  return (
    <Card title={label}>
      <div className="flex items-center justify-between">
        <Icon aria-hidden="true" className="text-muted size-5" />
        <span className={`text-xs font-semibold ${state.classes}`}>
          ● {state.label}
        </span>
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <span className="text-muted">
          {status.channel === 'AUDIBLE' ? 'Districts' : 'Citizens'}
        </span>
        <span className="font-semibold">{count.format(status.recipients)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} delivered`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="bg-neutral-tint mt-2 h-1.5 overflow-hidden rounded-full"
      >
        <div className="bg-success h-full" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-success mt-2 text-xs font-semibold">
        Delivered: {count.format(status.delivered)}
      </p>
      {status.attempts > 1 && (
        <p className="text-muted text-xs">Attempts: {status.attempts}</p>
      )}
      {status.lastError && status.state === 'FAILED' && (
        <p className="text-danger mt-1 text-xs">{status.lastError}</p>
      )}
      {status.state === 'FAILED' && onRetry && (
        <Button
          variant="ghost"
          className="mt-3 w-full"
          loading={retrying}
          icon={<RotateCw aria-hidden="true" className="size-4" />}
          onClick={onRetry}
          aria-label={`Retry ${label}`}
        >
          Retry
        </Button>
      )}
    </Card>
  );
}
