import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RescueTeamItem } from '@repo/types';
import { RESCUE_ELIGIBILITY } from '@repo/types';

import { fetchRescueTeams } from '../../api/rescue';
import { Banner } from '../../components/ui/Banner';
import { Skeleton } from '../../components/ui/Skeleton';

export function AvailableTeamsPage() {
  const { eventId, districtCode } = useParams<{
    eventId: string;
    districtCode: string;
  }>();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<RescueTeamItem[]>([]);
  const [includeExternal, setIncludeExternal] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTime, setRefreshTime] = useState<string>('');

  const activeDistrict = districtCode || 'Gampaha';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchRescueTeams(activeDistrict, includeExternal);
        if (!cancelled) {
          setTeams(data);
          setRefreshTime(
            new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          );

          // Default select first available and eligible team if none selected
          const eligible = data.find(
            (t) =>
              t.currentStatus === 'AVAILABLE' &&
              (t.eligibility === RESCUE_ELIGIBILITY.ELIGIBLE ||
                t.eligibility === RESCUE_ELIGIBILITY.CROSS_DISTRICT_ALLOWED),
          );
          if (eligible) {
            setSelectedTeamId((prev) => prev || eligible.id);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load rescue teams');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeDistrict, includeExternal]);

  const handleContinue = () => {
    const chosen = teams.find((t) => t.id === selectedTeamId);
    if (!chosen) return;

    navigate('/district/assign', {
      state: {
        eventId: eventId || 'flood-warning',
        eventName: 'Flood Warning',
        districtCode: activeDistrict,
        teamId: chosen.id,
        teamName: chosen.name,
        organization: chosen.organization,
        teamStatus: chosen.currentStatus,
        eligibility: chosen.eligibility,
      },
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Available Rescue Teams
        </h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted">
          <Link
            to={`/district/events/${encodeURIComponent(eventId || 'flood')}/districts`}
            className="hover:text-orange transition-colors"
          >
            Flood Warning
          </Link>
          <span>&gt;</span>
          <span className="font-semibold text-ink">
            {activeDistrict} District
          </span>
        </div>
      </div>

      {/* Info Notice Banner */}
      <div className="bg-neutral-tint border border-border rounded-xl p-4 flex items-center gap-3 text-sm text-ink">
        <Info className="size-5 shrink-0 text-navy" />
        <span>
          The selected team's availability will be rechecked and locked on
          confirmation.
        </span>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="bg-surface border border-border rounded-xl shadow-xs p-6 space-y-6">
        {/* Toggle Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="inline-flex rounded-lg border border-border p-1 bg-page/60">
            <button
              type="button"
              onClick={() => setIncludeExternal(false)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                !includeExternal
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-ink hover:text-navy'
              }`}
            >
              Local teams
            </button>
            <button
              type="button"
              onClick={() => setIncludeExternal(true)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                includeExternal
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-ink hover:text-navy'
              }`}
            >
              Include permitted external teams
            </button>
          </div>

          <p className="text-xs text-muted">
            Availability refreshed {refreshTime || '10:22 AM'}
          </p>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : teams.length === 0 ? (
          <div className="py-10 px-4 text-center bg-page/40 border border-dashed border-border rounded-xl space-y-4">
            <div className="space-y-1">
              <p className="font-bold text-ink text-base">
                No local rescue teams currently available in {activeDistrict}.
              </p>
              <p className="text-xs text-muted max-w-md mx-auto">
                All local units in this district are either assigned or offline.
                You can search external teams permitted to provide
                cross-district support, select another affected district, or end
                the dispatch.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!includeExternal && (
                <button
                  type="button"
                  onClick={() => setIncludeExternal(true)}
                  className="bg-navy hover:bg-navy-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Search Permitted External Teams
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/district/events/${encodeURIComponent(eventId || 'flood')}/districts`,
                  )
                }
                className="border border-border bg-surface hover:border-orange hover:text-orange text-ink text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Select Another District
              </button>
              <button
                type="button"
                onClick={() => navigate('/district/events')}
                className="text-muted hover:text-ink text-xs font-semibold px-3 py-2 cursor-pointer"
              >
                Cancel &amp; End Dispatch
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-page/30 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-5 py-3.5">Team</th>
                  <th className="px-5 py-3.5">Organization</th>
                  <th className="px-5 py-3.5">District</th>
                  <th className="px-5 py-3.5">Current Status</th>
                  <th className="px-5 py-3.5">Eligibility</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teams.map((t) => {
                  const isSelected = selectedTeamId === t.id;
                  const isAvailable = t.currentStatus === 'AVAILABLE';

                  return (
                    <tr
                      key={t.id}
                      className={
                        isSelected
                          ? 'bg-orange-tint/40'
                          : 'hover:bg-page/40 transition-colors'
                      }
                    >
                      <td className="px-5 py-4 font-bold text-ink">{t.name}</td>
                      <td className="px-5 py-4 text-ink">{t.organization}</td>
                      <td className="px-5 py-4 text-ink">{t.districtName}</td>
                      <td className="px-5 py-4">
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
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold ${
                            t.eligibility === RESCUE_ELIGIBILITY.ELIGIBLE
                              ? 'bg-success-tint text-success'
                              : t.eligibility ===
                                  RESCUE_ELIGIBILITY.CROSS_DISTRICT_ALLOWED
                                ? 'bg-neutral-tint text-navy'
                                : 'bg-danger-tint text-danger'
                          }`}
                        >
                          {t.eligibility === RESCUE_ELIGIBILITY.ELIGIBLE
                            ? 'Eligible'
                            : t.eligibility ===
                                RESCUE_ELIGIBILITY.CROSS_DISTRICT_ALLOWED
                              ? 'Cross-district support allowed'
                              : 'Not available'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {!isAvailable ? (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center justify-center border border-border bg-page/70 text-muted px-4 py-1.5 rounded-lg text-xs font-semibold cursor-not-allowed"
                          >
                            Disabled
                          </button>
                        ) : isSelected ? (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center bg-orange text-white px-5 py-1.5 rounded-lg text-xs font-semibold shadow-xs"
                          >
                            Selected
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedTeamId(t.id)}
                            className="inline-flex items-center justify-center border border-border text-ink hover:border-orange hover:text-orange bg-surface px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Select
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Continue Action */}
        <div className="flex justify-end pt-4 border-t border-border">
          <button
            type="button"
            disabled={!selectedTeamId}
            onClick={handleContinue}
            className="inline-flex items-center justify-center bg-navy hover:bg-navy-hover disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
