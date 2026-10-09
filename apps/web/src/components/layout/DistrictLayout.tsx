import {
  Activity,
  Boxes,
  Compass,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { config } from '../../config';
import { HealthStatus } from '../HealthStatus';

const DISTRICT_NAV_ITEMS = [
  {
    to: '/district/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    to: '/district/events',
    label: 'Active Events',
    icon: Activity,
  },
  {
    to: '/district/operations',
    label: 'Rescue Operations',
    icon: LifeBuoy,
  },
  {
    to: '/district/shelters',
    label: 'Shelters',
    icon: Home,
  },
  {
    to: '/district/resources',
    label: 'Resources',
    icon: Boxes,
  },
];

function DistrictSidebar({ onNavigate }: { onNavigate: () => void }) {
  return (
    <nav
      aria-label="District Operations Navigation"
      className="bg-navy flex h-full w-60 flex-col text-white"
    >
      <div className="flex items-center gap-3 border-b border-white/10 p-4">
        <span
          aria-hidden="true"
          className="bg-orange flex size-9 items-center justify-center rounded-lg text-white"
        >
          <LifeBuoy className="size-5" />
        </span>
        <div>
          <p className="font-bold">District Portal</p>
          <p className="text-xs text-white/70">Emergency Operations</p>
        </div>
      </div>

      <ul className="flex-1 space-y-1 p-3">
        {DISTRICT_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-navy-hover border-orange font-semibold text-white'
                    : 'hover:bg-navy-hover border-transparent text-white/80'
                }`
              }
            >
              <Icon aria-hidden="true" className="size-4" />
              <span className="flex-1">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="border-t border-white/10 p-4 text-xs text-white/80 space-y-3">
        <HealthStatus surface="dark" />
        <Link
          to="/reports/pending"
          className="flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white transition-colors"
        >
          <Compass className="size-4" />
          <span>Switch to DMC Portal</span>
        </Link>
      </div>
    </nav>
  );
}

function DistrictTopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="border-border bg-surface flex h-14 items-center gap-3 border-b px-4">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenu}
        className="hover:bg-page rounded-lg p-2 lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="bg-navy flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
        >
          {config.officerName.charAt(0).toUpperCase()}
        </span>
        <div className="text-xs leading-tight">
          <p className="font-semibold text-ink">{config.officerName}</p>
          <p className="text-success flex items-center gap-1">
            <span
              aria-hidden="true"
              className="bg-success size-1.5 rounded-full"
            />
            District Officer
          </p>
        </div>
      </div>
    </header>
  );
}

export function DistrictLayout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen lg:block">
        <DistrictSidebar onNavigate={() => setNavOpen(false)} />
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <DistrictSidebar onNavigate={() => setNavOpen(false)} />
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="flex-1 bg-ink/50 p-3 text-left text-white"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <DistrictTopBar onMenu={() => setNavOpen(true)} />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
