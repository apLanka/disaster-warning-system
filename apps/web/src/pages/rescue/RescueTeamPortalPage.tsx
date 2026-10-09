import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CloudOff,
  Compass,
  History,
  Inbox,
  LifeBuoy,
  Loader2,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import type { MissionStatus, RescueAssignment } from '@repo/types';
import { MISSION_STATUS } from '@repo/types';

import {
  fetchLeaderMissions,
  getPendingStatusQueue,
  queueStatusUpdateLocally,
  syncPendingStatusUpdates,
  updateMissionStatus,
} from '../../api/rescue';
import { MissionStatusStepper } from '../../components/rescue/MissionStatusStepper';
import { MissionTimelineFeed } from '../../components/rescue/MissionTimelineFeed';
import { Banner } from '../../components/ui/Banner';
import { Skeleton } from '../../components/ui/Skeleton';

export function RescueTeamPortalPage() {
  const { id } = useParams<{ id: string }>();

  const leaderId = 'leader-squad-1';
  const [allMissions, setAllMissions] = useState<RescueAssignment[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    id || null,
  );
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [customNotes, setCustomNotes] = useState('');
  const [pendingQueueCount, setPendingQueueCount] = useState(() => {
    const q = getPendingStatusQueue();
    return Array.isArray(q) ? q.length : 0;
  });

  const refreshQueueCount = useCallback(() => {
    const q = getPendingStatusQueue();
    setPendingQueueCount(Array.isArray(q) ? q.length : 0);
  }, []);

  const loadAllMissions = useCallback(
    async (isBackground = false) => {
      try {
        if (!isBackground) setLoading(true);
        setError(null);
        const data = await fetchLeaderMissions(leaderId);
        setAllMissions(data);
        refreshQueueCount();

        // Auto-select latest active mission if none explicitly selected or if current is completed
        setSelectedMissionId((prev) => {
          if (id) return id;
          if (prev) {
            const matched = data.find(
              (m) => m.missionId === prev || m.id === prev,
            );
            if (
              matched &&
              matched.status !== MISSION_STATUS.COMPLETED &&
              matched.status !== MISSION_STATUS.CANCELLED
            ) {
              return matched.missionId;
            }
          }
          const firstActive = data.find(
            (m) =>
              m.status !== MISSION_STATUS.COMPLETED &&
              m.status !== MISSION_STATUS.CANCELLED,
          );
          return firstActive
            ? firstActive.missionId
            : data[0]?.missionId || null;
        });
      } catch (err: unknown) {
        if (!isBackground) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load assigned missions.',
          );
        }
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [id, leaderId, refreshQueueCount],
  );

  const handleSyncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      setSyncing(true);
      const res = await syncPendingStatusUpdates();
      refreshQueueCount();
      if (res.syncedCount > 0) {
        setSuccessMessage(`Synchronized ${res.syncedCount} pending updates.`);
        await loadAllMissions(true);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch {
      // Ignore network sync issues
    } finally {
      setSyncing(false);
    }
  }, [loadAllMissions, refreshQueueCount]);

  // Online / Offline state listener
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

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const data = await fetchLeaderMissions(leaderId);
        if (cancelled) return;
        setAllMissions(data);
        refreshQueueCount();

        setSelectedMissionId((prev) => {
          if (id) return id;
          if (prev) {
            const matched = data.find(
              (m) => m.missionId === prev || m.id === prev,
            );
            if (
              matched &&
              matched.status !== MISSION_STATUS.COMPLETED &&
              matched.status !== MISSION_STATUS.CANCELLED
            ) {
              return matched.missionId;
            }
          }
          const firstActive = data.find(
            (m) =>
              m.status !== MISSION_STATUS.COMPLETED &&
              m.status !== MISSION_STATUS.CANCELLED,
          );
          return firstActive
            ? firstActive.missionId
            : data[0]?.missionId || null;
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load assigned missions.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, leaderId, refreshQueueCount]);

  // Polling for live assignments from District Officer (every 4 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) {
        void loadAllMissions(true);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [loadAllMissions]);

  const activeMissions = allMissions.filter(
    (m) =>
      m.status !== MISSION_STATUS.COMPLETED &&
      m.status !== MISSION_STATUS.CANCELLED,
  );

  const completedMissions = allMissions.filter(
    (m) =>
      m.status === MISSION_STATUS.COMPLETED ||
      m.status === MISSION_STATUS.CANCELLED,
  );

  const currentMission =
    allMissions.find(
      (m) => m.missionId === selectedMissionId || m.id === selectedMissionId,
    ) ||
    (activeTab === 'ACTIVE' ? activeMissions[0] : completedMissions[0]) ||
    null;

  const handleExecuteStatusUpdate = useCallback(
    async (nextStatus: MissionStatus, notes?: string) => {
      if (!currentMission) return;

      if (!navigator.onLine) {
        // SQ6: Store in local pending status queue
        queueStatusUpdateLocally(currentMission.id, {
          status: nextStatus,
          notes,
          leaderId,
        });
        refreshQueueCount();
        setAllMissions((prev) =>
          prev.map((m) =>
            m.id === currentMission.id ||
            m.missionId === currentMission.missionId
              ? {
                  ...m,
                  status: nextStatus,
                  updatedAt: new Date().toISOString(),
                  syncStatus: 'PENDING_OFFLINE',
                }
              : m,
          ),
        );
        setSuccessMessage(
          `Offline: Mission status queued locally as ${nextStatus.replace('_', ' ')}. Will sync when reconnected.`,
        );
        setTimeout(() => setSuccessMessage(null), 5000);
        return;
      }

      const optimisticNote =
        notes || `Status transitioned to ${nextStatus.replace('_', ' ')}.`;
      const optimisticUpdated: RescueAssignment = {
        ...currentMission,
        status: nextStatus,
        notes: notes || currentMission.notes,
        updatedAt: new Date().toISOString(),
        timeline: [
          ...(currentMission.timeline || []),
          {
            status: nextStatus,
            by: leaderId || 'Team Leader',
            at: new Date().toISOString(),
            note: optimisticNote,
          },
        ],
      };

      // Immediate 0ms optimistic UI update
      setAllMissions((prev) =>
        prev.map((m) =>
          m.id === currentMission.id || m.missionId === currentMission.missionId
            ? optimisticUpdated
            : m,
        ),
      );
      setSuccessMessage(
        `Mission status successfully updated to ${nextStatus.replace('_', ' ')}.`,
      );
      setCustomNotes('');
      setTimeout(() => setSuccessMessage(null), 4000);

      // If finished, transition view cleanly
      if (
        nextStatus === MISSION_STATUS.COMPLETED ||
        nextStatus === MISSION_STATUS.CANCELLED
      ) {
        const nextActive = allMissions.find(
          (m) =>
            m.id !== currentMission.id &&
            m.missionId !== currentMission.missionId &&
            m.status !== MISSION_STATUS.COMPLETED &&
            m.status !== MISSION_STATUS.CANCELLED,
        );
        if (nextActive) {
          setSelectedMissionId(nextActive.missionId);
          setActiveTab('ACTIVE');
        } else {
          setActiveTab('COMPLETED');
          setSelectedMissionId(currentMission.missionId);
        }
      }

      try {
        setUpdating(true);
        setError(null);
        const updated = await updateMissionStatus(currentMission.id, {
          status: nextStatus,
          notes,
          leaderId,
        });
        setAllMissions((prev) =>
          prev.map((m) =>
            m.id === updated.id || m.missionId === updated.missionId
              ? updated
              : m,
          ),
        );
      } catch {
        // SQ6 fallback: if network fails during request, offer offline queue
        queueStatusUpdateLocally(currentMission.id, {
          status: nextStatus,
          notes,
          leaderId,
        });
        refreshQueueCount();
        setAllMissions((prev) =>
          prev.map((m) =>
            m.id === currentMission.id ||
            m.missionId === currentMission.missionId
              ? {
                  ...m,
                  status: nextStatus,
                  updatedAt: new Date().toISOString(),
                  syncStatus: 'PENDING_OFFLINE',
                }
              : m,
          ),
        );
        setSuccessMessage(
          `Connection failed: Update queued locally as Pending Sync.`,
        );
        setTimeout(() => setSuccessMessage(null), 5000);
      } finally {
        setUpdating(false);
      }
    },
    [currentMission, leaderId, allMissions, refreshQueueCount],
  );

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
                Live Dispatch Connected
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
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
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
                Authorized Leader ID:{' '}
                <span className="font-mono font-semibold text-ink">
                  {leaderId}
                </span>{' '}
                &bull; Active Unit:{' '}
                <span className="font-semibold text-ink">
                  {currentMission?.rescueTeamName || 'Assigned Rescue Squad'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || syncing}
              onClick={() => {
                if (navigator.onLine) {
                  void handleSyncQueue();
                  void loadAllMissions(false);
                }
              }}
              className="inline-flex items-center gap-1.5 border border-border bg-page hover:bg-surface text-ink text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <RefreshCw
                className={`size-3.5 ${syncing || loading ? 'animate-spin' : ''}`}
              />
              {syncing ? 'Syncing...' : 'Refresh Missions'}
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

        {/* Mission Tabs: Active Deployments vs Completed History */}
        <div className="flex border-b border-border gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ACTIVE');
              const firstActive = activeMissions[0];
              if (
                firstActive &&
                !activeMissions.some((m) => m.missionId === selectedMissionId)
              ) {
                setSelectedMissionId(firstActive.missionId);
              }
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'border-orange text-orange'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Radio className="size-4" />
            Active Deployments
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'ACTIVE'
                  ? 'bg-orange text-white'
                  : 'bg-page border border-border text-muted'
              }`}
            >
              {activeMissions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('COMPLETED');
              const firstCompleted = completedMissions[0];
              if (
                firstCompleted &&
                !completedMissions.some(
                  (m) => m.missionId === selectedMissionId,
                )
              ) {
                setSelectedMissionId(firstCompleted.missionId);
              }
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'COMPLETED'
                ? 'border-orange text-orange'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <History className="size-4" />
            Completed Operations
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'COMPLETED'
                  ? 'bg-orange text-white'
                  : 'bg-page border border-border text-muted'
              }`}
            >
              {completedMissions.length}
            </span>
          </button>
        </div>

        {loading && allMissions.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-8 space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : activeTab === 'ACTIVE' ? (
          /* ACTIVE TAB CONTENT */
          activeMissions.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-10 text-center space-y-3">
              <div className="size-12 bg-navy/5 text-muted rounded-full flex items-center justify-center mx-auto">
                <Inbox className="size-6" />
              </div>
              <h2 className="text-base font-bold text-ink">
                No Active Emergency Deployments
              </h2>
              <p className="text-xs text-muted max-w-md mx-auto">
                Your squad is on standby. When a District Officer dispatches a
                new rescue mission, it will appear here automatically in real
                time.
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-orange bg-orange-tint px-3 py-1 rounded-full">
                <span className="size-2 rounded-full bg-orange animate-ping" />
                Listening for incoming dispatches...
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Mission Selector Pills (if multiple active missions) */}
              {activeMissions.length > 1 && (
                <div className="flex flex-wrap gap-2 items-center bg-surface border border-border p-3 rounded-xl">
                  <span className="text-xs font-semibold text-muted mr-1">
                    Select Active Mission:
                  </span>
                  {activeMissions.map((m) => {
                    const isSelected =
                      m.missionId === selectedMissionId ||
                      m.id === selectedMissionId;
                    return (
                      <button
                        key={m.id || m.missionId}
                        type="button"
                        onClick={() => setSelectedMissionId(m.missionId)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-orange text-white shadow-xs'
                            : 'bg-page border border-border text-ink hover:border-orange/50'
                        }`}
                      >
                        <span>{m.missionId}</span>
                        <span className="opacity-80 text-[10px]">
                          ({m.status.replace('_', ' ')})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Live Mission Progress Stepper */}
              {currentMission && (
                <MissionStatusStepper
                  status={currentMission.status}
                  lastUpdated={currentMission.updatedAt}
                />
              )}

              {/* Selected Active Mission Details Card */}
              {currentMission && (
                <div className="bg-surface border border-border rounded-2xl shadow-xs overflow-hidden">
                  {/* Header section with mission meta */}
                  <div className="p-6 border-b border-border space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-muted tracking-wider uppercase">
                          Assigned Mission ID
                        </span>
                        <p className="text-2xl font-extrabold text-ink tracking-tight mt-0.5">
                          {currentMission.missionId}
                        </p>
                      </div>

                      <div>
                        <span
                          className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                            currentMission.syncStatus === 'PENDING_OFFLINE'
                              ? 'bg-warning-tint text-warning-text border border-dashed border-orange'
                              : currentMission.status ===
                                  MISSION_STATUS.ON_SCENE
                                ? 'bg-orange-tint text-orange font-bold'
                                : currentMission.status ===
                                    MISSION_STATUS.EN_ROUTE
                                  ? 'bg-navy/10 text-navy'
                                  : 'bg-orange-tint text-orange'
                          }`}
                        >
                          {currentMission.syncStatus === 'PENDING_OFFLINE'
                            ? 'PENDING SYNC (OFFLINE)'
                            : currentMission.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div className="bg-page/50 border border-border/80 rounded-xl p-3.5">
                        <p className="text-xs text-muted">Disaster Event</p>
                        <p className="font-bold text-sm text-ink mt-0.5">
                          {currentMission.disasterEventName}
                        </p>
                      </div>

                      <div className="bg-page/50 border border-border/80 rounded-xl p-3.5">
                        <p className="text-xs text-muted">Rescue Squad</p>
                        <p className="font-bold text-sm text-ink mt-0.5">
                          {currentMission.rescueTeamName}{' '}
                          <span className="text-xs font-normal text-muted">
                            ({currentMission.organization})
                          </span>
                        </p>
                      </div>

                      <div className="bg-page/50 border border-border/80 rounded-xl p-3.5">
                        <p className="text-xs text-muted">District</p>
                        <p className="font-bold text-sm text-ink mt-0.5">
                          {currentMission.districtName ||
                            currentMission.districtCode}
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
                        {currentMission.emergencyLocation}
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
                        Transition the deployment through each required response
                        stage.
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
                        placeholder="e.g. Squad en route with boat unit, ETA 10 minutes..."
                        className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-orange transition-colors"
                      />
                    </div>

                    {/* Lifecycle Stage Buttons */}
                    <div className="grid grid-cols-1 gap-3">
                      {currentMission.status === MISSION_STATUS.ASSIGNED && (
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

                      {currentMission.status === MISSION_STATUS.EN_ROUTE && (
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

                      {currentMission.status === MISSION_STATUS.ON_SCENE && (
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
                    </div>

                    {/* Timestamp & Metadata Footer */}
                    <div className="pt-3 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-muted">
                      <span>
                        Last Updated:{' '}
                        <span className="font-semibold text-ink">
                          {new Date(
                            currentMission.updatedAt,
                          ).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </span>
                      <span className="font-mono text-[11px]">
                        Sync ID: {currentMission.id}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mission Activity Timeline Feed */}
              {currentMission && (
                <MissionTimelineFeed timeline={currentMission.timeline} />
              )}
            </div>
          )
        ) : /* COMPLETED TAB CONTENT */
        completedMissions.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-10 text-center space-y-3">
            <div className="size-12 bg-navy/5 text-muted rounded-full flex items-center justify-center mx-auto">
              <History className="size-6" />
            </div>
            <h2 className="text-base font-bold text-ink">
              No Completed Operations Recorded
            </h2>
            <p className="text-xs text-muted max-w-md mx-auto">
              Once active rescue missions are marked as completed by your team
              leader, they will be archived here for record keeping.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {completedMissions.map((m) => (
                <div
                  key={m.id || m.missionId}
                  className="bg-surface border border-border rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-ink">
                        {m.missionId}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-success-tint text-success text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="size-3" />
                        {m.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-muted">
                        &bull; {m.disasterEventName}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-orange" />
                        {m.emergencyLocation} (
                        {m.districtName || m.districtCode})
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        Completed:{' '}
                        {new Date(m.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-muted">
                    Team:{' '}
                    <span className="font-semibold text-ink">
                      {m.rescueTeamName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
