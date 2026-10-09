import { Megaphone, TriangleAlert } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import {
  districtName,
  HAZARD_TYPE_LABELS,
  type HazardWarningDto,
  type WarningView,
} from '@repo/types';

import { describeWarningError, listWarnings } from '../api/hazardWarnings';
import { Pagination } from '../components/reports/Pagination';
import { LevelChip } from '../components/warnings/LevelChip';
import { WarningStatusChip } from '../components/warnings/WarningStatusChip';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { formatIncidentTime } from '../lib/format';
import { editWarningPath, NEW_WARNING_PATH, warningPath } from '../lib/routes';

const PAGE_SIZE = 20;
const VIEWS: {
  view: WarningView;
  label: string;
  empty: string;
  when: (w: HazardWarningDto) => string | undefined;
}[] = [
  {
    view: 'active',
    label: 'Active',
    empty: 'No active warnings',
    when: (w) => w.issuedAt,
  },
  {
    view: 'drafts',
    label: 'Drafts',
    empty: 'No drafts',
    when: (w) => w.updatedAt,
  },
  {
    view: 'past',
    label: 'Past',
    empty: 'No past warnings',
    when: (w) => w.cancellation?.cancelledAt ?? w.validUntil,
  },
];
const WHEN_HEADER: Record<WarningView, string> = {
  active: 'Issued',
  drafts: 'Last edited',
  past: 'Ended',
};

function readView(value: string | null): WarningView {
  return VIEWS.some((item) => item.view === value)
    ? (value as WarningView)
    : 'active';
}

export function WarningsListPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const view = readView(params.get('view'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const current = VIEWS.find((item) => item.view === view)!;
  const { data, error, loading, reload } = useResource(
    (signal) => listWarnings({ view, page, limit: PAGE_SIZE }, signal),
    [view, page],
  );
  usePageTitle('Hazard warnings');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Hazard Warnings</h1>
        <Link
          to={NEW_WARNING_PATH}
          className="bg-orange inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
        >
          <Megaphone aria-hidden="true" className="size-4" />
          Issue Warning
        </Link>
      </div>
      {notice && <Banner tone="success">{notice}</Banner>}

      <div
        role="tablist"
        aria-label="Warning views"
        className="border-border flex gap-1 border-b"
      >
        {VIEWS.map((item) => (
          <button
            key={item.view}
            type="button"
            role="tab"
            aria-selected={item.view === view}
            onClick={() => setParams({ view: item.view })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${item.view === view ? 'border-orange text-ink' : 'text-muted border-transparent'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card>
        <div role="tabpanel" aria-label={`${current.label} warnings`}>
          {loading && !data ? (
            <div
              role="status"
              aria-label="Loading warnings"
              className="space-y-2"
            >
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !data ? (
            <Banner
              tone="danger"
              action={
                <Button variant="ghost" onClick={reload}>
                  Retry
                </Button>
              }
            >
              {describeWarningError(error)}
            </Banner>
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={<TriangleAlert className="size-10" />}
              title={current.empty}
            />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted text-xs uppercase">
                    <tr>
                      <th className="py-2 pr-4">Reference</th>
                      <th className="py-2 pr-4">Hazard</th>
                      <th className="py-2 pr-4">Level</th>
                      <th className="py-2 pr-4">Districts</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">{WHEN_HEADER[view]}</th>
                      <th className="py-2">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {data.items.map((item) => {
                      const when = current.when(item);
                      const draft = item.status === 'DRAFT';
                      return (
                        <tr key={item.id}>
                          <td className="py-3 pr-4 font-mono">
                            {item.reference}
                          </td>
                          <td className="py-3 pr-4">
                            {HAZARD_TYPE_LABELS[item.hazardType]}
                          </td>
                          <td className="py-3 pr-4">
                            <LevelChip level={item.level} />
                          </td>
                          <td className="py-3 pr-4">
                            {item.districts.map(districtName).join(', ')}
                          </td>
                          <td className="py-3 pr-4">
                            <WarningStatusChip warning={item} />
                          </td>
                          <td className="text-muted py-3 pr-4">
                            {when ? formatIncidentTime(when) : '—'}
                          </td>
                          <td className="py-3 text-right">
                            <Link
                              to={
                                draft
                                  ? editWarningPath(item.id)
                                  : warningPath(item.id)
                              }
                              aria-label={`${draft ? 'Edit' : 'View'} ${item.reference}`}
                              className="text-orange font-semibold"
                            >
                              {draft ? 'Edit' : 'View'}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={data.page}
                limit={data.limit}
                total={data.total}
                noun="warnings"
                onChange={(next) => setParams({ view, page: String(next) })}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
