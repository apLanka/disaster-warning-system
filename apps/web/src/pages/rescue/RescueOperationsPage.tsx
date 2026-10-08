import { useEffect, useState } from 'react';
import { Eye, LifeBuoy, Plus, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { RescueTeamItem } from '@repo/types';

import { fetchRescueTeams } from '../../api/rescue';
import { Banner } from '../../components/ui/Banner';
import { Skeleton } from '../../components/ui/Skeleton';

export function RescueOperationsPage() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<RescueTeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchRescueTeams(undefined, true);
        if (!cancelled) setTeams(data);
      } catch (err: any) {
        if (!cancelled)
          setError(err.message || 'Failed to load rescue operations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshIndex]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <LifeBuoy className="size-6 text-orange" />
            Rescue Operations &amp; Teams
          </h1>
          <p className="text-sm text-muted mt-1">
            Monitor active rescue deployments, team availability, and district
            assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRefreshIndex((i) => i + 1)}
            className="inline-flex items-center gap-1.5 border border-border bg-surface hover:bg-page text-ink text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate('/district/events')}
            className="inline-flex items-center gap-1.5 bg-orange hover:bg-orange/90 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
            Dispatch Rescue Team
          </button>
        </div>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      {loading ? (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          No rescue teams currently registered.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-page/50 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-6 py-4">Team</th>
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Home District</th>
                  <th className="px-6 py-4">Current Status</th>
                  <th className="px-6 py-4">Cross-District Support</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teams.map((t) => (
                  <tr key={t.id} className="hover:bg-page/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-ink">{t.name}</td>
                    <td className="px-6 py-4 text-ink">{t.organization}</td>
                    <td className="px-6 py-4 text-ink">{t.districtName}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold ${
                          t.currentStatus === 'AVAILABLE'
                            ? 'bg-success-tint text-success'
                            : 'bg-warning-tint text-warning-text'
                        }`}
                      >
                        {t.currentStatus === 'AVAILABLE'
                          ? 'Available'
                          : 'Assigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold ${
                          t.allowsCrossDistrict
                            ? 'bg-neutral-tint text-navy'
                            : 'bg-page text-muted'
                        }`}
                      >
                        {t.allowsCrossDistrict ? 'Permitted' : 'Local Only'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {t.currentStatus === 'ASSIGNED' ? (
                        <Link
                          to="/district/missions/RA-001"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange hover:underline"
                        >
                          <Eye className="size-3.5" /> View Mission
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate('/district/events')}
                          className="text-xs font-semibold text-orange hover:underline cursor-pointer"
                        >
                          Dispatch
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
