import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { RescueAssignment } from '@repo/types';
import { MISSION_STATUS } from '@repo/types';

import { fetchMission, updateMissionStatus } from '../../api/rescue';
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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchMission(id!);
        if (!cancelled) setMission(data);
      } catch (err: any) {
        if (!cancelled)
          setError(err.message || 'Failed to load assigned mission');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleStartResponse = async () => {
    if (!mission) return;
    try {
      setUpdating(true);
      setError(null);
      const updated = await updateMissionStatus(mission.id, {
        status: MISSION_STATUS.EN_ROUTE,
        notes: 'Rescue team departed base, en route to emergency location.',
      });
      setMission(updated);
      setSuccessMessage('Mission status updated to En Route.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update mission status');
    } finally {
      setUpdating(false);
    }
  };

  const handleCustomStatusUpdate = async () => {
    if (!mission) return;
    try {
      setUpdating(true);
      setError(null);
      const updated = await updateMissionStatus(mission.id, {
        status: statusChoice as any,
        notes: statusNote || undefined,
      });
      setMission(updated);
      setStatusModalOpen(false);
      setSuccessMessage(
        `Mission status updated to ${statusChoice.replace('_', ' ')}.`,
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update mission status');
    } finally {
      setUpdating(false);
    }
  };

  const statusBadge = (st: string) => {
    switch (st) {
      case 'EN_ROUTE':
        return 'bg-neutral-tint text-navy';
      case 'ON_SCENE':
        return 'bg-warning-tint text-warning-text';
      case 'COMPLETED':
        return 'bg-success-tint text-success';
      case 'CANCELLED':
        return 'bg-danger-tint text-danger';
      case 'ASSIGNED':
      default:
        return 'bg-orange-tint text-orange';
    }
  };

  const statusLabel = (st: string) => {
    switch (st) {
      case 'EN_ROUTE':
        return 'En Route';
      case 'ON_SCENE':
        return 'On Scene';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'ASSIGNED':
      default:
        return 'Assigned';
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto py-4">
      {error && <Banner tone="danger">{error}</Banner>}
      {successMessage && <Banner tone="success">{successMessage}</Banner>}

      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-8 space-y-4 shadow-sm">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !mission ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center text-muted">
          Mission details not found.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
          {/* Dark Navy Header */}
          <div className="bg-navy px-6 py-4 text-white flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">
              Assigned Mission
            </h1>
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
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted">Mission ID</p>
                <p className="text-lg font-bold text-ink mt-0.5">
                  {mission.missionId}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted">Emergency Location</p>
                <p className="text-base font-bold text-ink mt-0.5">
                  {mission.emergencyLocation}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted">Assigned Team</p>
                <p className="text-base font-bold text-ink mt-0.5">
                  {mission.rescueTeamName}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted mb-1">Current Status</p>
                <span
                  className={`inline-block px-3.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                    mission.status,
                  )}`}
                >
                  {statusLabel(mission.status)}
                </span>
              </div>

              <div>
                <p className="text-xs text-muted">Last Updated</p>
                <p className="text-sm font-bold text-ink mt-0.5">
                  {new Date(mission.updatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Inner Location Panel */}
            <div className="border border-border bg-page/60 rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-muted">Location</p>
              <p className="text-sm font-bold text-ink">
                {mission.emergencyLocation}
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                disabled={
                  updating || mission.status !== MISSION_STATUS.ASSIGNED
                }
                onClick={handleStartResponse}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 bg-orange hover:bg-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer"
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
                disabled={updating}
                onClick={() => setStatusModalOpen(true)}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 border border-border text-ink hover:border-orange hover:text-orange bg-surface px-5 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className="size-4" />
                Update Status
              </button>
            </div>
          </div>
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
              {mission?.rescueTeamName}.
            </p>

            <div className="space-y-2 pt-2">
              {[
                { val: 'EN_ROUTE', label: 'En Route (Dispatched & Traveling)' },
                { val: 'ON_SCENE', label: 'On Scene (Active Operations)' },
                { val: 'COMPLETED', label: 'Completed (Mission Accomplished)' },
                { val: 'CANCELLED', label: 'Cancelled (Stood Down)' },
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    statusChoice === opt.val
                      ? 'border-orange bg-orange-tint/40 text-ink font-semibold'
                      : 'border-border hover:bg-page text-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="statusChoice"
                    value={opt.val}
                    checked={statusChoice === opt.val}
                    onChange={(e) => setStatusChoice(e.target.value)}
                    className="accent-orange"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>

            <div>
              <label
                htmlFor="statusNote"
                className="block text-xs font-semibold text-muted mb-1"
              >
                Operational Notes (Optional)
              </label>
              <textarea
                id="statusNote"
                rows={2}
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="e.g. 5 survivors evacuated to safe shelter"
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
                onClick={handleCustomStatusUpdate}
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
