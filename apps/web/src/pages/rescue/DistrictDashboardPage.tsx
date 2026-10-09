import { Activity, Boxes, Home, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DistrictDashboardPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          District Operations Dashboard
        </h1>
        <p className="text-sm text-muted mt-1">
          Coordinate local emergency response, rescue team dispatching, and
          district resources.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/district/events"
          className="bg-surface border border-border hover:border-orange p-6 rounded-xl shadow-xs transition-all flex items-start gap-4 group"
        >
          <div className="bg-orange-tint text-orange group-hover:bg-orange group-hover:text-white p-3 rounded-lg transition-colors">
            <Activity className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink group-hover:text-orange transition-colors">
              Active Disaster Events
            </h2>
            <p className="text-xs text-muted mt-1">
              Review current hazards, affected districts, and initiate rescue
              dispatches.
            </p>
          </div>
        </Link>

        <Link
          to="/district/operations"
          className="bg-surface border border-border hover:border-orange p-6 rounded-xl shadow-xs transition-all flex items-start gap-4 group"
        >
          <div className="bg-success-tint text-success group-hover:bg-success group-hover:text-white p-3 rounded-lg transition-colors">
            <LifeBuoy className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink group-hover:text-orange transition-colors">
              Rescue Operations
            </h2>
            <p className="text-xs text-muted mt-1">
              Track dispatched teams, live mission statuses, and unit
              availability.
            </p>
          </div>
        </Link>

        <Link
          to="/district/shelters"
          className="bg-surface border border-border hover:border-orange p-6 rounded-xl shadow-xs transition-all flex items-start gap-4 group"
        >
          <div className="bg-warning-tint text-warning-text group-hover:bg-[#d97706] group-hover:text-white p-3 rounded-lg transition-colors">
            <Home className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink group-hover:text-orange transition-colors">
              District Shelters
            </h2>
            <p className="text-xs text-muted mt-1">
              Monitor shelter capacities, live occupancy, and evacuee counts.
            </p>
          </div>
        </Link>

        <Link
          to="/district/resources"
          className="bg-surface border border-border hover:border-orange p-6 rounded-xl shadow-xs transition-all flex items-start gap-4 group"
        >
          <div className="bg-navy/10 text-navy group-hover:bg-navy group-hover:text-white p-3 rounded-lg transition-colors">
            <Boxes className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink group-hover:text-orange transition-colors">
              Emergency Resources
            </h2>
            <p className="text-xs text-muted mt-1">
              Manage rations, medical kits, water supply, and relief
              distributions.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
