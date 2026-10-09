import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Shield,
  Siren,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { RescueAssignment } from '@repo/types';
import { MISSION_STATUS } from '@repo/types';

import { fetchMission, updateMissionStatus } from '../../api/rescue';
import { MissionStatusStepper } from '../../components/rescue/MissionStatusStepper';
import { MissionTimelineFeed } from '../../components/rescue/MissionTimelineFeed';
import { Banner } from '../../components/ui/Banner';
import { Skeleton } from '../../components/ui/Skeleton';

export function AssignedMissionPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [mission, setMission] = useState<RescueAssignment | null>(
    (location.state as any)?.assignment || null,
  );
  const [loading, setLoading] = useState(!mission);
  const [updating, setUpdating] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusChoice, setStatusChoice] = useState<string>('EN_ROUTE');
  const [statusNote, setStatusNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(
    () => new Date(),
  );

  const refreshMission = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchMission(id);
      setMission(data);
      setLastRefreshedAt(new Date());
    } catch {
      // Background sync errors ignored
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const data = await fetchMission(id!);
        if (!cancelled) {
          setMission(data);
          setLastRefreshedAt(new Date());
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load assigned mission',
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
  }, [id]);

  // Fast background polling every 3 seconds for live synchronized status
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      void refreshMission();
    }, 3000);

    return () => clearInterval(interval);
  }, [id, refreshMission]);

  const handleStartResponse = async () => {
    if (!mission) return;
    const prevMission = mission;
    const nextStatus = MISSION_STATUS.EN_ROUTE;
    const note = 'Rescue squad departed base, in transit to emergency scene.';

    // Instant optimistic update (0ms latency feedback)
    setMission((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: nextStatus,
        notes: note,
        updatedAt: new Date().toISOString(),
        timeline: [
          ...(prev.timeline || []),
          {
            status: nextStatus,
            by: 'Team Leader',
            at: new Date().toISOString(),
            note,
          },
        ],
      };
    });
    setSuccessMessage('Mission status updated to En Route.');
    setTimeout(() => setSuccessMessage(null), 4000);

    try {
      setUpdating(true);
      setError(null);
      const updated = await updateMissionStatus(mission.id, {
        status: nextStatus,
        notes: note,
      });
      setMission(updated);
    } catch (err: unknown) {
      // Revert optimistic update on failure
      setMission(prevMission);
      setError(
        err instanceof Error ? err.message : 'Failed to update mission status',
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleCustomStatusUpdate = async () => {
    if (!mission) return;
    const prevMission = mission;
    const nextStatus = statusChoice as any;
    const note = statusNote || undefined;

    // Instant optimistic update and close modal immediately
    setStatusModalOpen(false);
    setMission((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: nextStatus,
        notes: note || prev.notes,
        updatedAt: new Date().toISOString(),
        timeline: [
          ...(prev.timeline || []),
          {
            status: nextStatus,
            by: 'Team Leader',
            at: new Date().toISOString(),
            note:
              note ||
              `Status transitioned to ${String(nextStatus).replace('_', ' ')}.`,
          },
        ],
      };
    });
    setSuccessMessage(
      `Mission status updated to ${statusChoice.replace('_', ' ')}.`,
    );
    setStatusNote('');
    setTimeout(() => setSuccessMessage(null), 4000);

    try {
      setUpdating(true);
      setError(null);
      const updated = await updateMissionStatus(mission.id, {
        status: nextStatus,
        notes: note,
      });
      setMission(updated);
    } catch (err: unknown) {
      // Revert optimistic update on failure
      setMission(prevMission);
      setError(
        err instanceof Error ? err.message : 'Failed to update mission status',
      );
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadgeStyle = (st: string) => {
    switch (st) {
      case 'EN_ROUTE':
        return 'bg-neutral-tint text-navy border-navy/20';
      case 'ON_SCENE':
        return 'bg-warning-tint text-warning-text border-warning-text/30';
      case 'COMPLETED':
        return 'bg-success-tint text-success border-success/30';
      case 'CANCELLED':
        return 'bg-danger-tint text-danger border-danger/30';
      case 'ASSIGNED':
      default:
        return 'bg-orange-tint text-orange border-orange/30';
    }
  };

  const getStatusLabel = (st: string) => {
    switch (st) {
      case 'EN_ROUTE':
        return 'En Route (In Transit)';
      case 'ON_SCENE':
        return 'On Scene (Operating)';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled / Stood Down';
      case 'ASSIGNED':
      default:
        return 'Assigned (Alerted)';
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-4">
      {/* Top Breadcrumb & Live Sync Pill */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/district/operations')}
          className="text-xs text-muted hover:text-ink flex items-center gap-1 font-semibold transition-colors cursor-pointer"
        >
          &larr; Back to Rescue Operations
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-success-tint border border-success/30 text-success text-[11px] font-bold px-3 py-1 rounded-full">
            <span className="size-2 rounded-full bg-success animate-pulse" />
            Live Sync Connected
          </span>
          <button
            type="button"
            title="Refresh now"
            onClick={() => void refreshMission()}
            className="text-muted hover:text-ink transition-colors cursor-pointer p-1"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}
      {successMessage && <Banner tone="success">{successMessage}</Banner>}

      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-8 space-y-4 shadow-xs">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !mission ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center text-muted">
          Mission details not found.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Visual 4-Stage Operational Stepper */}
          <MissionStatusStepper
            status={mission.status}
            lastUpdated={mission.updatedAt}
          />

          {/* Mission Details Main Card */}
          <div className="bg-surface border border-border rounded-2xl shadow-xs overflow-hidden">
            {/* Dark Navy Header */}
            <div className="bg-navy px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Siren className="size-5 text-orange" />
                <h1 className="text-lg font-bold tracking-tight">
                  Assigned Mission
                </h1>
              </div>
              <button
                type="button"
                onClick={() => navigate('/district/operations')}
                className="text-xs text-white/80 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                All Operations <ChevronRight className="size-3.5" />
              </button>
            </div>

            {/* Mission Body */}
            <div className="p-6 space-y-6">
              {/* Key Mission Attributes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-page/50 border border-border rounded-xl p-3.5 space-y-1">
                  <p className="text-xs text-muted">Mission ID</p>
                  <p className="text-base font-extrabold text-ink font-mono">
                    {mission.missionId}
                  </p>
                  <p className="text-[11px] text-muted">
                    {mission.disasterEventName}
                  </p>
                </div>

                <div className="bg-page/50 border border-border rounded-xl p-3.5 space-y-1">
                  <p className="text-xs text-muted flex items-center gap-1">
                    <Shield className="size-3.5 text-orange" />
                    Assigned Team
                  </p>
                  <p className="text-base font-bold text-ink">
                    {mission.rescueTeamName}
                  </p>
                  <p className="text-xs text-muted">{mission.organization}</p>
                </div>

                <div className="bg-page/50 border border-border rounded-xl p-3.5 space-y-1">
                  <p className="text-xs text-muted flex items-center gap-1">
                    <Clock className="size-3.5 text-muted" />
                    Current Status
                  </p>
                  <div className="pt-0.5">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeStyle(
                        mission.status,
                      )}`}
                    >
                      {getStatusLabel(mission.status)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Synced{' '}
                    {lastRefreshedAt.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {/* Emergency Location Banner */}
              <div className="border border-orange/30 bg-orange-tint/40 rounded-xl p-4 space-y-1">
                <p className="text-xs font-bold text-orange uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> Emergency Deployment Location
                </p>
                <p className="text-base font-extrabold text-ink">
                  {mission.emergencyLocation}
                </p>
                <p className="text-xs text-muted">
                  District: {mission.districtName || mission.districtCode}
                </p>
              </div>

              {/* Primary Action Buttons for District Officer */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={
                    updating || mission.status !== MISSION_STATUS.ASSIGNED
                  }
                  onClick={handleStartResponse}
                  className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 bg-orange hover:bg-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {updating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Navigation className="size-4" />
                  )}
                  Start Response
                </button>

                <button
                  type="button"
                  disabled={
                    updating ||
                    mission.status === MISSION_STATUS.COMPLETED ||
                    mission.status === MISSION_STATUS.CANCELLED
                  }
                  onClick={() => {
                    // Preselect next logical status
                    if (mission.status === MISSION_STATUS.ASSIGNED) {
                      setStatusChoice('EN_ROUTE');
                    } else if (mission.status === MISSION_STATUS.EN_ROUTE) {
                      setStatusChoice('ON_SCENE');
                    } else if (mission.status === MISSION_STATUS.ON_SCENE) {
                      setStatusChoice('COMPLETED');
                    }
                    setStatusModalOpen(true);
                  }}
                  className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 border border-border text-ink hover:border-orange hover:text-orange bg-surface px-5 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  <RefreshCw className="size-4" />
                  Update Status
                </button>
              </div>
            </div>
          </div>

          {/* Live Activity Timeline Feed */}
          <MissionTimelineFeed timeline={mission.timeline} />
        </div>
      )}

      {/* Modal for Status Lifecycle Updates */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink">
              Update Mission Status
            </h2>
            <p className="text-xs text-muted">
              Select the latest synchronized status for Rescue Team{' '}
              <strong className="text-ink">{mission?.rescueTeamName}</strong>.
            </p>

            <div className="space-y-2 pt-2">
              {[
                {
                  val: 'EN_ROUTE',
                  label: 'En Route',
                  desc: 'Squad mobilized and in transit',
                },
                {
                  val: 'ON_SCENE',
                  label: 'On Scene',
                  desc: 'Arrived at emergency location & operating',
                },
                {
                  val: 'COMPLETED',
                  label: 'Completed',
                  desc: 'Mission accomplished & victims evacuated',
                },
                {
                  val: 'CANCELLED',
                  label: 'Cancelled',
                  desc: 'Mission stood down by command',
                },
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    statusChoice === opt.val
                      ? 'border-orange bg-orange-tint/40 text-ink'
                      : 'border-border hover:bg-page text-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="statusChoice"
                    value={opt.val}
                    checked={statusChoice === opt.val}
                    onChange={(e) => setStatusChoice(e.target.value)}
                    className="accent-orange mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-bold block text-ink">
                      {opt.label}
                    </span>
                    <span className="text-xs text-muted">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            <div>
              <label
                htmlFor="statusNote"
                className="block text-xs font-semibold text-muted mb-1"
              >
                Operational Situation Notes (Optional)
              </label>
              <textarea
                id="statusNote"
                rows={2}
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="e.g. 10 civilians evacuated safely to higher ground"
                className="w-full bg-surface border border-border rounded-lg p-2.5 text-xs text-ink outline-none focus:border-orange focus:ring-1 focus:ring-orange"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-lg text-ink hover:bg-page cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={() => void handleCustomStatusUpdate()}
                className="px-5 py-2 text-xs font-semibold bg-orange hover:bg-orange/90 text-white rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                {updating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
