import type { NotificationLogDto } from '@repo/types';

import { formatClock } from '../../lib/format';

/** Newest first, a dot coloured by outcome (green sent, red failed). */
export function DeliveryActivity({ logs }: { logs: NotificationLogDto[] }) {
  if (logs.length === 0)
    return <p className="text-muted text-sm">No delivery activity yet.</p>;
  return (
    <ol className="space-y-2">
      {logs.map((log) => (
        <li key={log.id} className="flex gap-2 text-sm">
          <span
            aria-hidden="true"
            className={`mt-1.5 size-2 shrink-0 rounded-full ${log.outcome === 'SENT' ? 'bg-success' : 'bg-danger'}`}
          />
          <span className="text-muted font-mono text-xs leading-5">
            {formatClock(log.createdAt)}
          </span>
          <span>
            <span className="sr-only">
              {log.outcome === 'SENT' ? 'Sent: ' : 'Failed: '}
            </span>
            {log.message}
          </span>
        </li>
      ))}
    </ol>
  );
}
