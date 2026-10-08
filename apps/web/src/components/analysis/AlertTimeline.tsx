import {
  ALERT_LABEL_TEXT,
  ALERT_LEVEL_LABELS,
  type AlertLevel,
  type AlertTimelineItem,
} from '@repo/types';

import { formatDayTime, formatNumber } from '../../lib/format';

// The level is always written out as well as coloured.
const DOT_CLASSES: Record<AlertLevel, string> = {
  CRITICAL: 'bg-danger',
  HIGH: 'bg-orange',
  MEDIUM: 'bg-warning-text',
  LOW: 'bg-success',
};

/** The warnings in time order: a connected line of dots, readable as a plain list. */
export function AlertTimeline({ items }: { items: AlertTimelineItem[] }) {
  return (
    <ol aria-label="Alert timeline" className="flex gap-4 overflow-x-auto pb-2">
      {items.map((item) => (
        <li key={item.id} className="relative min-w-44 flex-1 pt-6">
          <span
            aria-hidden="true"
            className="bg-border absolute top-2 right-0 left-0 h-0.5"
          />
          <span
            aria-hidden="true"
            className={`absolute top-0.5 left-0 size-4 rounded-full ring-2 ring-white ${DOT_CLASSES[item.level]}`}
          />
          <p className="font-semibold">{ALERT_LABEL_TEXT[item.label]}</p>
          <p className="text-muted text-xs">{formatDayTime(item.at)}</p>
          <p className="text-xs">
            <span className="font-semibold">
              {ALERT_LEVEL_LABELS[item.level]}
            </span>
            {' · '}
            {item.title}
          </p>
          <p className="text-muted text-xs">
            Reached {formatNumber(item.reached)} of{' '}
            {formatNumber(item.targeted)}
          </p>
        </li>
      ))}
    </ol>
  );
}
