import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CloudOff,
  Compass,
  LifeBuoy,
  Loader2,
  Navigation,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { MissionStatus, RescueAssignment } from '@repo/types';
import { MISSION_STATUS } from '@repo/types';

import {
  fetchLeaderMission,
  getPendingStatusQueue,
  queueStatusUpdateLocally,
  syncPendingStatusUpdates,
  updateMissionStatus,
} from '../../api/rescue';
import { Banner } from '../../components/ui/Banner';
import { Skeleton } from '../../components/ui/Skeleton';

export function RescueTeamPortalPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const activeMissionId = id || 'RA-001';
  const leaderId = 'leader-squad-1';
  const [mission, setMission] = useState<RescueAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingQueueCount, setPendingQueueCount] = useState(() => {
    const q = getPendingStatusQueue();
    return Array.isArray(q) ? q.length : 0;
  });

  const refreshQueueCount = useCallback(() => {
    const q = getPendingStatusQueue();
    setPendingQueueCount(Array.isArray(q) ? q.length : 0);
  }, []);

  const handleSyncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      setSyncing(true);
      const res = await syncPendingStatusUpdates();
      refreshQueueCount();
      if (res.syncedCount > 0) {
        setSuccessMessage(`Synchronized ${res.syncedCount} pending updates.`);
        const refreshed = await fetchLeaderMission(activeMissionId, leaderId);
        setMission(refreshed);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch {
      // Ignore network sync issues
    } finally {
      setSyncing(false);
    }
  }, [activeMissionId, leaderId, refreshQueueCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void handleSyncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleSyncQueue]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchLeaderMission(activeMissionId, leaderId);
        if (!cancelled) {
          setMission(data);
          refreshQueueCount();
        }
      } catch (err: any) {
        if (!cancelled)
          setError(err.message || 'Failed to load assigned mission details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeMissionId, leaderId, refreshQueueCount]);

  const handleExecuteStatusUpdate = async (
    nextStatus: MissionStatus,
    notes?: string,
  ) => {
    if (!mission) return;

    if (!navigator.onLine) {
      // SQ6: Store in local pending status queue
      queueStatusUpdateLocally(mission.id, {
        status: nextStatus,
        notes,
        leaderId,
      });
      refreshQueueCount();
      setMission((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
              syncStatus: 'PENDING_OFFLINE',
            }
          : null,
      );
      setSuccessMessage(
        `Offline: Mission status queued locally as ${nextStatus.replace('_', ' ')}. Will sync when reconnected.`,
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      return;
    }

    try {
      setUpdating(true);
      setError(null);
      const updated = await updateMissionStatus(mission.id, {
        status: nextStatus,
        notes,
        leaderId,
      });
      setMission(updated);
      setSuccessMessage(
        `Mission status successfully updated to ${nextStatus.replace('_', ' ')}.`,
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      // SQ6 fallback: if network fails during request, offer offline queue
      queueStatusUpdateLocally(mission.id, {
        status: nextStatus,
        notes,
        leaderId,
      });
      refreshQueueCount();
      setMission((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
              syncStatus: 'PENDING_OFFLINE',
            }
          : null,
      );
      setSuccessMessage(
        `Connection failed: Update queued locally as Pending Sync.`,
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } finally {
      setUpdating(false);
    }
  };

  const [customNotes, setCustomNotes] = useState('');

  return (
    <div className="min-h-screen bg-page text-ink flex flex-col">
      {/* Standalone Rescue Portal Header */}
      <header className="bg-navy border-b border-white/10 text-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="bg-orange flex size-9 items-center justify-center rounded-xl text-white shadow-xs"
            >
              <LifeBuoy className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight">
                  Rescue Team Leader Portal
                </span>
                <span className="bg-orange/20 border border-orange/40 text-orange text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider">
                  Field Ops
                </span>
              </div>
              <p className="text-xs text-white/60">
                Disaster Warning &amp; Emergency Dispatch System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 bg-success/20 border border-success/40 text-success text-xs font-semibold px-3 py-1 rounded-full">
                <span className="size-2 rounded-full bg-success animate-pulse" />
                Online &amp; Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-danger/20 border border-danger/40 text-danger text-xs font-semibold px-3 py-1 rounded-full">
                <CloudOff className="size-3.5" />
                Offline Mode (Local Queue Active)
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Top Operational Status Banner */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="bg-navy/5 p-3 rounded-xl border border-border text-navy">
              <ShieldCheck className="size-6 text-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-ink">
                  Rescue Team Leader Interface
                </h1>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Authorized Officer ID:{' '}
                <span className="font-mono font-semibold text-ink">
                  {leaderId}
                </span>{' '}
                &bull; Active Unit:{' '}
                <span className="font-semibold text-ink">
                  {mission?.rescueTeamName || 'Assigned Squad'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || syncing}
              onClick={() => {
                if (navigator.onLine) handleSyncQueue();
              }}
              className="inline-flex items-center gap-1.5 border border-border bg-page hover:bg-surface text-ink text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3.5 ${syncing ? 'animate-spin' : ''}`}
              />
              {syncing ? 'Syncing...' : 'Refresh Status'}
            </button>
          </div>
        </div>

        {/* Offline Queue Indicator (SQ6) */}
        {pendingQueueCount > 0 && (
          <div className="bg-warning-tint border border-border p-4 rounded-xl flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2.5 text-warning-text font-semibold">
              <CloudOff className="size-4 text-warning-text shrink-0" />
              <span>
                {pendingQueueCount} pending status update(s) stored locally in
                offline queue.
              </span>
            </div>
            {isOnline && (
              <button
                type="button"
                disabled={syncing}
                onClick={handleSyncQueue}
                className="bg-navy hover:bg-navy-hover text-white px-3.5 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {syncing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Sync Queue
              </button>
            )}
          </div>
        )}

        {error && <Banner tone="danger">{error}</Banner>}
        {successMessage && <Banner tone="success">{successMessage}</Banner>}

        {loading ? (
          <div className="bg-surface border border-border rounded-2xl p-8 space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !mission ? (
          <div className="bg-surface border border-border rounded-2xl p-8 text-center text-muted space-y-3">
            <p>
              No active mission assignment found for reference ID:{' '}
              {activeMissionId}
            </p>
            <button
              type="button"
              onClick={() => navigate('/rescue-leader/missions/RA-001')}
              className="text-xs font-semibold text-orange hover:underline cursor-pointer"
            >
              Load Default Assignment (RA-001)
            </button>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl shadow-xs overflow-hidden">
            {/* Header section with mission meta */}
            <div className="p-6 border-b border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-muted tracking-wider uppercase">
                    Assigned Mission ID
                  </span>
                  <p className="text-2xl font-extrabold text-ink tracking-tight mt-0.5">
                    {mission.missionId}
                  </p>
                </div>

                <div>
                  <span
                    className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                      mission.syncStatus === 'PENDING_OFFLINE'
                        ? 'bg-warning-tint text-warning-text border border-dashed border-orange'
                        : mission.status === MISSION_STATUS.COMPLETED
                          ? 'bg-success-tint text-success'
                          : mission.status === MISSION_STATUS.ON_SCENE
                            ? 'bg-orange-tint text-orange font-bold'
                            : mission.status === MISSION_STATUS.EN_ROUTE
                              ? 'bg-neutral-tint text-navy'
                              : 'bg-orange-tint text-orange'
                    }`}
                  >
                    {mission.syncStatus === 'PENDING_OFFLINE'
                      ? 'PENDING SYNC (OFFLINE)'
                      : mission.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-page/50 border border-border/80 rounded-xl p-3.5">
                  <p className="text-xs text-muted">Disaster Event</p>
                  <p className="font-bold text-sm text-ink mt-0.5">
                    {mission.disasterEventName}
                  </p>
                </div>

                <div className="bg-page/50 border border-border/80 rounded-xl p-3.5">
                  <p className="text-xs text-muted">Rescue Team</p>
                  <p className="font-bold text-sm text-ink mt-0.5">
                    {mission.rescueTeamName}{' '}
                    <span className="text-xs font-normal text-muted">
                      ({mission.organization})
                    </span>
                  </p>
                </div>

                <div className="bg-page/50 border border-border/80 rounded-xl p-3.5">
                  <p className="text-xs text-muted">District</p>
                  <p className="font-bold text-sm text-ink mt-0.5">
                    {mission.districtName || mission.districtCode}
                  </p>
                </div>
              </div>

              {/* Emergency Destination Location */}
              <div className="bg-orange-tint/40 border border-orange/30 rounded-xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-orange uppercase tracking-wider">
                  <Navigation className="size-3.5" /> Emergency Deployment
                  Location
                </div>
                <p className="text-base font-extrabold text-ink">
                  {mission.emergencyLocation}
                </p>
              </div>
            </div>

            {/* Mission Operational Actions */}
            <div className="p-6 bg-page/30 space-y-5">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Update Mission Operational Status (SQ5)
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Update the status as your unit progresses through deployment
                  stages.
                </p>
              </div>

              {/* Optional Field Notes */}
              <div className="space-y-1.5">
                <label
                  htmlFor="leader-notes"
                  className="block text-xs font-semibold text-ink"
                >
                  Situation Notes (Optional)
                </label>
                <input
                  id="leader-notes"
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="e.g. Squad en route via A1 road, ETA 15 mins..."
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-orange transition-colors"
                />
              </div>

              {/* Lifecycle Stage Buttons */}
              <div className="grid grid-cols-1 gap-3">
                {mission.status === MISSION_STATUS.ASSIGNED && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      handleExecuteStatusUpdate(
                        MISSION_STATUS.EN_ROUTE,
                        customNotes ||
                          'Rescue team departed base, en route to emergency location.',
                      )
                    }
                    className="w-full bg-orange hover:bg-orange/90 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                  >
                    {updating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Navigation className="size-4" />
                    )}
                    Start Response &rarr; En Route
                  </button>
                )}

                {mission.status === MISSION_STATUS.EN_ROUTE && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      handleExecuteStatusUpdate(
                        MISSION_STATUS.ON_SCENE,
                        customNotes ||
                          'Rescue squad arrived at emergency location and initiated operations.',
                      )
                    }
                    className="w-full bg-navy hover:bg-navy-hover text-white font-bold py-3.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                  >
                    {updating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Compass className="size-4" />
                    )}
                    Mark Arrived &rarr; On Scene
                  </button>
                )}

                {mission.status === MISSION_STATUS.ON_SCENE && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      handleExecuteStatusUpdate(
                        MISSION_STATUS.COMPLETED,
                        customNotes ||
                          'Rescue operation and victim evacuation completed.',
                      )
                    }
                    className="w-full bg-success hover:opacity-90 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                  >
                    {updating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Complete Mission
                  </button>
                )}

                {mission.status === MISSION_STATUS.COMPLETED && (
                  <div className="bg-success-tint border border-success/30 text-success p-4 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="size-4" />
                    Mission successfully completed and finalized.
                  </div>
                )}
              </div>

              {/* Timestamp & Metadata Footer */}
              <div className="pt-3 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-muted">
                <span>
                  Last Updated:{' '}
                  <span className="font-semibold text-ink">
                    {new Date(mission.updatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </span>
                <span className="font-mono text-[11px]">
                  Sync ID: {mission.id}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
