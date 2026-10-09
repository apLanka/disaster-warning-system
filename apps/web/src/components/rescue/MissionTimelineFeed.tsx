import { Clock, History, User } from 'lucide-react';
import type { MissionStatus, MissionTimelineEntry } from '@repo/types';

interface MissionTimelineFeedProps {
  timeline?: MissionTimelineEntry[];
  className?: string;
}

function getStatusStyle(st: MissionStatus) {
  switch (st) {
    case 'EN_ROUTE':
      return {
        badge: 'bg-neutral-tint text-navy border-navy/20',
        dot: 'bg-navy',
        label: 'En Route',
      };
    case 'ON_SCENE':
      return {
        badge: 'bg-warning-tint text-warning-text border-warning-text/30',
        dot: 'bg-orange',
        label: 'On Scene',
      };
    case 'COMPLETED':
      return {
        badge: 'bg-success-tint text-success border-success/30',
        dot: 'bg-success',
        label: 'Completed',
      };
    case 'CANCELLED':
      return {
        badge: 'bg-danger-tint text-danger border-danger/30',
        dot: 'bg-danger',
        label: 'Cancelled',
      };
    case 'ASSIGNED':
    default:
      return {
        badge: 'bg-orange-tint text-orange border-orange/30',
        dot: 'bg-orange',
        label: 'Assigned',
      };
  }
}

export function MissionTimelineFeed({
  timeline = [],
  className = '',
}: MissionTimelineFeedProps) {
  if (!timeline || timeline.length === 0) {
    return null;
  }

  // Display newest update at top or chronological
  const sortedEntries = [...timeline].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return (
    <div
      className={`bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
          <History className="size-4 text-orange" />
          Mission Activity Audit Feed
        </h3>
        <span className="text-[11px] text-muted">
          {timeline.length} milestone{timeline.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {sortedEntries.map((entry, idx) => {
          const config = getStatusStyle(entry.status);
          const dateObj = new Date(entry.at);
          const timeStr = dateObj.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={`${entry.status}-${entry.at}-${idx}`}
              className="relative group"
            >
              {/* Timeline Indicator Dot */}
              <div
                className={`absolute -left-6 top-1 size-3.5 rounded-full border-2 border-surface ${config.dot} ring-2 ring-border/80 shadow-xs`}
              />

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${config.badge}`}
                  >
                    {config.label}
                  </span>

                  <span className="text-xs text-muted flex items-center gap-1">
                    <Clock className="size-3" />
                    {timeStr}
                  </span>

                  <span className="text-xs font-semibold text-ink flex items-center gap-1 bg-page px-2 py-0.5 rounded-md border border-border/60">
                    <User className="size-3 text-muted" />
                    {entry.by || 'Duty Officer'}
                  </span>
                </div>

                {entry.note && (
                  <p className="text-xs text-ink/90 font-medium pl-0.5 mt-1 leading-relaxed bg-page/50 p-2 rounded-lg border border-border/40">
                    {entry.note}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
