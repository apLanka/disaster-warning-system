import { Bell, Menu, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { config } from '../../config';
import { ReportStatsProvider } from '../../context/ReportStatsProvider';
import { useReportStats } from '../../hooks/useReportStats';
import { HealthStatus } from '../HealthStatus';
import { NAV_ITEMS } from './navItems';

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { stats } = useReportStats();

  return (
    <nav
      aria-label="Main"
      className="bg-navy flex h-full w-60 flex-col text-white"
    >
      <div className="flex items-center gap-3 border-b border-white/10 p-4">
        <span
          aria-hidden="true"
          className="bg-orange flex size-9 items-center justify-center rounded-lg"
        >
          <ShieldAlert className="size-5" />
        </span>
        <div>
          <p className="font-bold">DMC Portal</p>
          <p className="text-xs text-white/70">Disaster Management Centre</p>
        </div>
      </div>

      <ul className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, showPendingCount }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-navy-hover border-orange font-semibold'
                    : 'hover:bg-navy-hover border-transparent'
                }`
              }
            >
              <Icon aria-hidden="true" className="size-4" />
              <span className="flex-1">{label}</span>
              {showPendingCount && stats && stats.pending > 0 && (
                <span className="bg-orange rounded-full px-2 py-0.5 text-xs font-semibold">
                  <span className="sr-only">{stats.pending} pending: </span>
                  {stats.pending}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="border-t border-white/10 p-4 text-xs text-white/80">
        <HealthStatus surface="dark" />
      </div>
    </nav>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { stats } = useReportStats();
  const pending = stats?.pending ?? 0;

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

      <Link
        to="/reports/pending"
        aria-label={`${pending} ${pending === 1 ? 'report' : 'reports'} waiting for review`}
        className="hover:bg-page relative rounded-lg p-2"
      >
        <Bell aria-hidden="true" className="size-5" />
        {pending > 0 && (
          <span
            aria-hidden="true"
            className="bg-danger absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
          >
            {pending > 9 ? '9+' : pending}
          </span>
        )}
      </Link>

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="bg-navy flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
        >
          {config.officerName.charAt(0).toUpperCase()}
        </span>
        <div className="text-xs leading-tight">
          <p className="font-semibold">{config.officerName}</p>
          <p className="text-success flex items-center gap-1">
            <span
              aria-hidden="true"
              className="bg-success size-1.5 rounded-full"
            />
            On duty
          </p>
        </div>
      </div>
    </header>
  );
}

function Shell() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen lg:block">
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <Sidebar onNavigate={() => setNavOpen(false)} />
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
        <TopBar onMenu={() => setNavOpen(true)} />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  return (
    <ReportStatsProvider>
      <Shell />
    </ReportStatsProvider>
  );
}
