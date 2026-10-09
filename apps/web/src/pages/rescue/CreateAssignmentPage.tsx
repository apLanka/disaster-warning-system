import { useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { createRescueAssignment } from '../../api/rescue';
import { Banner } from '../../components/ui/Banner';

interface LocationState {
  eventId?: string;
  eventName?: string;
  districtCode?: string;
  teamId?: string;
  teamName?: string;
  organization?: string;
  teamStatus?: string;
  eligibility?: string;
}

export function CreateAssignmentPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = (location.state as LocationState) || {};

  const eventId = state.eventId || 'flood-warning';
  const eventName = state.eventName || 'Flood Warning';
  const districtCode = state.districtCode || 'Gampaha';
  const teamId = state.teamId || 'mock-team-a';
  const teamName = state.teamName || 'Team A';
  const organization = state.organization || 'DMC';
  const teamStatus = state.teamStatus || 'AVAILABLE';

  const [emergencyLocation, setEmergencyLocation] = useState(
    'Riverside Area, Gampaha',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyLocation.trim()) {
      setError('Please enter the emergency response location.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // SQ1, SQ2 & SQ7: Atomically validate and create assignment in a single fast request
      const assignment = await createRescueAssignment({
        disasterEventId: eventId,
        districtCode,
        rescueTeamId: teamId,
        emergencyLocation: emergencyLocation.trim(),
      });

      // Navigate to Screen 5 (Assigned Mission)
      navigate(
        `/district/missions/${encodeURIComponent(assignment.id || assignment.missionId)}`,
        {
          state: { assignment },
        },
      );
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('no longer available')) {
        setError(
          err.message ||
            'Selected rescue team is no longer available. Please select another team.',
        );
      } else if (err.status === 400) {
        setError(
          err.message || 'Validation failed for the requested dispatch.',
        );
      } else {
        // SQ7: Exception flow - assignment could not be saved
        setError('Rescue assignment could not be saved. Please retry.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Create Rescue Assignment
        </h1>
        <p className="mt-1 text-sm text-muted">
          Assign and dispatch authorized rescue team to the emergency location.
        </p>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
      >
        {/* Left Form Card */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6 shadow-xs space-y-5">
          <div>
            <label
              htmlFor="disasterEvent"
              className="block text-xs font-semibold text-muted mb-1.5"
            >
              Disaster Event
            </label>
            <input
              id="disasterEvent"
              type="text"
              readOnly
              value={eventName}
              className="w-full bg-page/50 border border-border rounded-lg px-4 py-2.5 text-sm font-semibold text-ink focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="affectedDistrict"
              className="block text-xs font-semibold text-muted mb-1.5"
            >
              Affected District
            </label>
            <input
              id="affectedDistrict"
              type="text"
              readOnly
              value={districtCode}
              className="w-full bg-page/50 border border-border rounded-lg px-4 py-2.5 text-sm font-semibold text-ink focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="selectedTeam"
              className="block text-xs font-semibold text-muted mb-1.5"
            >
              Selected Rescue Team
            </label>
            <input
              id="selectedTeam"
              type="text"
              readOnly
              value={teamName}
              className="w-full bg-page/50 border border-border rounded-lg px-4 py-2.5 text-sm font-semibold text-ink focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="emergencyLocation"
              className="block text-xs font-semibold text-muted mb-1.5"
            >
              Emergency Location
            </label>
            <input
              id="emergencyLocation"
              type="text"
              required
              value={emergencyLocation}
              onChange={(e) => setEmergencyLocation(e.target.value)}
              placeholder="e.g. Riverside Area, Gampaha"
              className="w-full bg-surface border border-border focus:border-orange focus:ring-1 focus:ring-orange rounded-lg px-4 py-2.5 text-sm text-ink outline-none transition-all"
            />
          </div>

          {/* Info Notice */}
          <div className="bg-neutral-tint border border-border rounded-xl p-4 flex items-center gap-3 text-xs text-ink">
            <Info className="size-4 shrink-0 text-navy" />
            <span>
              Availability and deployment eligibility will be rechecked and
              locked on confirmation.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center border border-border bg-surface hover:bg-page text-ink px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 bg-orange hover:bg-orange/90 disabled:opacity-50 text-white px-7 py-2.5 rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Confirm Assignment
            </button>
          </div>
        </div>

        {/* Right Summary Card */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-ink border-b border-border pb-3">
            Assignment Summary
          </h2>

          <div>
            <p className="text-xs text-muted">Team</p>
            <p className="text-base font-bold text-ink mt-0.5">{teamName}</p>
          </div>

          <div>
            <p className="text-xs text-muted">Organization</p>
            <p className="text-base font-bold text-ink mt-0.5">
              {organization}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted mb-1">Current Team Status</p>
            <span className="inline-block bg-success-tint text-success px-3 py-0.5 rounded-full text-xs font-semibold">
              {teamStatus === 'AVAILABLE' ? 'Available' : teamStatus}
            </span>
          </div>

          <div>
            <p className="text-xs text-muted mb-1">
              Mission Status on creation
            </p>
            <span className="inline-block bg-neutral-tint text-navy px-3 py-0.5 rounded-full text-xs font-semibold">
              Assigned
            </span>
          </div>

          <div>
            <p className="text-xs text-muted mb-1">Eligibility</p>
            <span className="inline-block bg-success-tint text-success px-3 py-0.5 rounded-full text-xs font-semibold">
              Deployment eligible
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
