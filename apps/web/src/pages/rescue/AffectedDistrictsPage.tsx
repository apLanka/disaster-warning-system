import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  ActiveDisasterEventSummary,
  AffectedDistrictInfo,
} from '@repo/types';

import { fetchEventDistricts } from '../../api/rescue';
import { Banner } from '../../components/ui/Banner';
import { Skeleton } from '../../components/ui/Skeleton';

export function AffectedDistrictsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<ActiveDisasterEventSummary | null>(null);
  const [districts, setDistricts] = useState<AffectedDistrictInfo[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Gampaha');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchEventDistricts(eventId!);
        if (!cancelled) {
          setEvent(data.event);
          setDistricts(data.districts);
          const active = data.districts.find(
            (d) =>
              d.rescueNeed.toLowerCase().includes('required') || d.selected,
          );
          if (active) setSelectedDistrict(active.districtName);
        }
      } catch (err: any) {
        if (!cancelled)
          setError(err.message || 'Failed to load affected districts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleSelectDistrict = (district: AffectedDistrictInfo) => {
    setSelectedDistrict(district.districtName);
    navigate(
      `/district/events/${encodeURIComponent(eventId || 'flood')}/districts/${encodeURIComponent(district.districtName)}/teams`,
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Affected Districts
        </h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted">
          <Link
            to="/district/events"
            className="hover:text-orange transition-colors"
          >
            Active Events
          </Link>
          <span>&gt;</span>
          <span className="font-semibold text-ink">
            {event?.name || 'Flood Warning'}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted">
          Select a district that requires rescue deployment.
        </p>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      {loading ? (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-page/50 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-6 py-4">District</th>
                  <th className="px-6 py-4">Warning Level</th>
                  <th className="px-6 py-4">Response Status</th>
                  <th className="px-6 py-4">Rescue Need</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {districts.map((d) => {
                  const isSelected =
                    selectedDistrict.toLowerCase() ===
                    d.districtName.toLowerCase();
                  return (
                    <tr
                      key={d.districtCode}
                      className={
                        isSelected
                          ? 'bg-orange-tint/40'
                          : 'hover:bg-page/40 transition-colors'
                      }
                    >
                      <td className="px-6 py-4 font-bold text-ink">
                        {d.districtName}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold ${
                            d.warningLevel === 'HIGH' ||
                            d.warningLevel === 'CRITICAL'
                              ? 'bg-danger-tint text-danger'
                              : 'bg-warning-tint text-warning-text'
                          }`}
                        >
                          {d.warningLevel === 'HIGH' ||
                          d.warningLevel === 'CRITICAL'
                            ? 'High'
                            : 'Medium'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-ink">
                        {d.responseStatus}
                      </td>
                      <td className="px-6 py-4 font-semibold text-ink">
                        {d.rescueNeed}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isSelected ? (
                          <button
                            type="button"
                            onClick={() => handleSelectDistrict(d)}
                            className="inline-flex items-center justify-center bg-orange hover:bg-orange/90 text-white px-5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            Selected
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectDistrict(d)}
                            className="inline-flex items-center justify-center border border-border text-ink hover:border-orange hover:text-orange bg-surface px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Select District
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
