import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ActiveDisasterEventSummary } from '@repo/types';

import { fetchActiveEvents } from '../../api/rescue';
import { Banner } from '../../components/ui/Banner';
import { Skeleton } from '../../components/ui/Skeleton';

export function ActiveEventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ActiveDisasterEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchActiveEvents();
        if (!cancelled) setEvents(data);
      } catch (err: any) {
        if (!cancelled)
          setError(err.message || 'Failed to load active disaster events');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Emergency Response Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted">
          Active Disaster Events &amp; Rapid Rescue Operations
        </p>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      {loading ? (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          No active disaster events currently recorded.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-surface border border-border rounded-xl p-6 shadow-xs hover:border-navy transition-colors"
            >
              <div className="space-y-3">
                <div>
                  <h2 className="text-xl font-bold text-ink">{event.name}</h2>
                  <div className="mt-1.5">
                    <span className="inline-block bg-warning-tint text-warning-text px-3 py-0.5 rounded-full text-xs font-semibold">
                      {event.badge || 'Escalated'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center pt-2">
                  <div>
                    <p className="text-xs text-muted">Affected Districts</p>
                    <p className="text-2xl font-bold text-ink mt-0.5">
                      {event.affectedDistrictsCount}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted">Warning Level</p>
                    <div className="mt-1">
                      <span className="inline-block bg-danger-tint text-danger px-3 py-0.5 rounded-full text-xs font-semibold">
                        {event.warningLevel === 'CRITICAL' ||
                        event.warningLevel === 'HIGH'
                          ? 'High'
                          : 'Medium'}
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-1">
                    <p className="text-xs text-muted">Response action</p>
                    <p className="text-sm font-semibold text-ink mt-0.5">
                      {event.responseAction || 'Rescue deployment required'}
                    </p>
                  </div>

                  <div className="flex justify-start sm:justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/district/events/${encodeURIComponent(event.id)}/districts`,
                        )
                      }
                      className="inline-flex items-center justify-center bg-navy hover:bg-navy-hover text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      View Event
                    </button>
                  </div>
                </div>

                <div className="pt-2 text-xs text-muted">
                  Updated{' '}
                  {new Date(event.updatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
