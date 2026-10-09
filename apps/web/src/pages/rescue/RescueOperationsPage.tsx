import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  LifeBuoy,
  Navigation,
  Plus,
  RefreshCw,
  ShieldAlert,
  Siren,
  Users,
} from 'lucide-react';
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
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(
    () => new Date(),
  );

  const refreshTeams = useCallback(async () => {
    try {
      const data = await fetchRescueTeams(undefined, true);
      setTeams(data);
      setLastRefreshedAt(new Date());
    } catch {
      // Background sync errors ignored
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const data = await fetchRescueTeams(undefined, true);
        if (!cancelled) {
          setTeams(data);
          setLastRefreshedAt(new Date());
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load rescue operations',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Background polling every 4 seconds for real-time field operations tracking
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshTeams();
    }, 4000);

    return () => clearInterval(interval);
  }, [refreshTeams]);

  // Calculate live KPI metrics
  const totalUnits = teams.length;
  const activeDeployments = teams.filter(
    (t) => t.currentStatus === 'ASSIGNED',
  ).length;
  const onSceneUnits = teams.filter(
    (t) => t.activeMissionStatus === 'ON_SCENE',
  ).length;
  const enRouteUnits = teams.filter(
    (t) => t.activeMissionStatus === 'EN_ROUTE',
  ).length;
  const availableUnits = teams.filter(
    (t) => t.currentStatus === 'AVAILABLE',
  ).length;

  const renderLiveStatusBadge = (team: RescueTeamItem) => {
    if (team.activeMissionStatus === 'ON_SCENE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning-tint text-warning-text border border-warning-text/30">
          <span className="size-2 rounded-full bg-orange animate-pulse" />
          On Scene (Operating)
        </span>
      );
    }
    if (team.activeMissionStatus === 'EN_ROUTE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-tint text-navy border border-navy/20">
          <span className="size-2 rounded-full bg-navy animate-pulse" />
          En Route (In Transit)
        </span>
      );
    }
    if (team.currentStatus === 'ASSIGNED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-tint text-orange border border-orange/30">
          <span className="size-2 rounded-full bg-orange" />
          Dispatched ({team.activeMissionId || 'Active'})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success-tint text-success border border-success/30">
        <span className="size-2 rounded-full bg-success" />
        Available (Standby)
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header and Live Status Beacon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
              <LifeBuoy className="size-6 text-orange" />
              Rescue Operations &amp; Teams
            </h1>
            <span className="inline-flex items-center gap-1.5 bg-success-tint border border-success/30 text-success text-[11px] font-bold px-3 py-0.5 rounded-full">
              <span className="size-2 rounded-full bg-success animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Real-time multi-agency rescue team dispatch, live transit tracking,
            and field statuses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refreshTeams()}
            className="inline-flex items-center gap-1.5 border border-border bg-surface hover:bg-page text-ink text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
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

      {/* Real-Time Operational KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Total Squads
            </span>
            <Users className="size-4 text-navy" />
          </div>
          <p className="text-2xl font-extrabold text-ink">{totalUnits}</p>
          <p className="text-[11px] text-muted mt-0.5">Registered Units</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Active Ops
            </span>
            <ShieldAlert className="size-4 text-orange" />
          </div>
          <p className="text-2xl font-extrabold text-orange">
            {activeDeployments}
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            {onSceneUnits > 0
              ? `${onSceneUnits} On Scene`
              : 'Field Deployments'}
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              In Transit
            </span>
            <Navigation className="size-4 text-navy" />
          </div>
          <p className="text-2xl font-extrabold text-navy">{enRouteUnits}</p>
          <p className="text-[11px] text-muted mt-0.5">En Route to Scenes</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Standby Ready
            </span>
            <CheckCircle2 className="size-4 text-success" />
          </div>
          <p className="text-2xl font-extrabold text-success">
            {availableUnits}
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            Available for Dispatch
          </p>
        </div>
      </div>

      {loading && teams.length === 0 ? (
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
          <div className="px-6 py-3 border-b border-border bg-page/30 flex items-center justify-between text-xs text-muted">
            <span className="font-semibold">
              Live Field Units Roster ({teams.length})
            </span>
            <span>
              Synced:{' '}
              {lastRefreshedAt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-page/50 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-6 py-4">Squad Name</th>
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Home District</th>
                  <th className="px-6 py-4">Live Mission Status</th>
                  <th className="px-6 py-4">Cross-District Support</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teams.map((t) => (
                  <tr key={t.id} className="hover:bg-page/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-ink flex items-center gap-2">
                      <Siren className="size-4 text-orange shrink-0" />
                      <span>{t.name}</span>
                    </td>
                    <td className="px-6 py-4 text-ink">{t.organization}</td>
                    <td className="px-6 py-4 text-ink">{t.districtName}</td>
                    <td className="px-6 py-4">{renderLiveStatusBadge(t)}</td>
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
                          to={`/district/missions/${encodeURIComponent(
                            t.activeMissionId || t.activeAssignmentId || t.id,
                          )}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-orange hover:underline bg-orange-tint px-3 py-1.5 rounded-lg border border-orange/20 transition-all hover:bg-orange hover:text-white"
                        >
                          <Eye className="size-3.5" /> View Mission
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate('/district/events')}
                          className="text-xs font-bold text-navy hover:underline cursor-pointer bg-neutral-tint px-3 py-1.5 rounded-lg border border-navy/20 transition-all hover:bg-navy hover:text-white"
                        >
                          Dispatch Squad
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
