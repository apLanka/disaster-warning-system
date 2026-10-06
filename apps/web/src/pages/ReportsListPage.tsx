import {
  CircleCheck,
  CircleX,
  FileText,
  FolderOpen,
  ListChecks,
  RefreshCw,
} from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';

import {
  HAZARD_TYPE_LABELS,
  HAZARD_TYPES,
  type HazardReportDto,
  type HazardType,
  type ReportSort,
} from '@repo/types';

import { describeError } from '../api/client';
import { listReports } from '../api/hazardReports';
import { Pagination } from '../components/reports/Pagination';
import { ReportsTable } from '../components/reports/ReportsTable';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, INPUT_CLASSES } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { StatCard } from '../components/ui/StatCard';
import { useNow } from '../hooks/useNow';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReportStats } from '../hooks/useReportStats';
import { useResource } from '../hooks/useResource';

export const PAGE_SIZE = 10;

type ListStatus = HazardReportDto['status'];

const COPY: Record<
  ListStatus,
  { title: string; subtitle: string; empty: string; hint: string }
> = {
  PENDING_VERIFICATION: {
    title: 'Pending Hazard Reports',
    subtitle: 'Reports submitted by citizens awaiting verification.',
    empty: 'No reports are waiting for review',
    hint: 'New citizen reports will appear here.',
  },
  VERIFIED: {
    title: 'Verified Reports',
    subtitle: 'Reports an officer has confirmed.',
    empty: 'No verified reports yet',
    hint: 'Reports appear here once an officer verifies them.',
  },
  REJECTED: {
    title: 'Rejected Reports',
    subtitle: 'Reports an officer could not accept, with the reason given.',
    empty: 'No rejected reports',
    hint: 'Reports appear here once an officer rejects them.',
  },
};

function readType(value: string | null): HazardType | undefined {
  return HAZARD_TYPES.find((type) => type === value);
}

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function ReportsListPage({ status }: { status: ListStatus }) {
  const copy = COPY[status];
  usePageTitle(copy.title);

  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const now = useNow();
  const { stats, refresh } = useReportStats();

  const type = readType(params.get('type'));
  const sort: ReportSort =
    params.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const page = readPage(params.get('page'));
  const filtered = type !== undefined;

  const { data, error, loading, reload } = useResource(
    (signal) =>
      listReports({ status, type, sort, page, limit: PAGE_SIZE }, signal),
    [status, type, sort, page],
  );

  const notice = (location.state as { notice?: string } | null)?.notice;

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  }

  function refreshAll() {
    reload();
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-muted text-sm">{copy.subtitle}</p>
        </div>
        <Button
          icon={<RefreshCw aria-hidden="true" className="size-4" />}
          loading={loading && data !== null}
          onClick={refreshAll}
        >
          Refresh
        </Button>
      </div>

      {notice && <Banner tone="success">{notice}</Banner>}

      {status === 'PENDING_VERIFICATION' && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Pending Reports"
            value={stats?.pending}
            icon={<FileText className="size-5" />}
            tone="warning"
          />
          <StatCard
            label="Verified Today"
            value={stats?.verifiedToday}
            icon={<CircleCheck className="size-5" />}
            tone="success"
          />
          <StatCard
            label="Rejected"
            value={stats?.rejected}
            icon={<CircleX className="size-5" />}
            tone="danger"
          />
          <StatCard
            label="Total Reports"
            value={stats?.total}
            icon={<ListChecks className="size-5" />}
            tone="neutral"
          />
        </div>
      )}

      <Card className="space-y-4 !p-0">
        <div className="flex flex-wrap items-end gap-4 p-4">
          <Field label="Hazard type" htmlFor="filter-type">
            <select
              id="filter-type"
              className={INPUT_CLASSES}
              value={type ?? ''}
              onChange={(event) =>
                update({ type: event.target.value, page: undefined })
              }
            >
              <option value="">All hazard types</option>
              {HAZARD_TYPES.map((value) => (
                <option key={value} value={value}>
                  {HAZARD_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort by" htmlFor="filter-sort">
            <select
              id="filter-sort"
              className={INPUT_CLASSES}
              value={sort}
              onChange={(event) =>
                update({
                  sort: event.target.value === 'oldest' ? 'oldest' : undefined,
                  page: undefined,
                })
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </Field>
          {data && (
            <p className="text-muted ml-auto text-sm" aria-live="polite">
              {data.total} {data.total === 1 ? 'report' : 'reports'}
            </p>
          )}
        </div>

        {error !== null && (
          <div className="px-4">
            <Banner
              tone="danger"
              action={
                <Button variant="ghost" onClick={reload}>
                  Retry
                </Button>
              }
            >
              {describeError(error)}
            </Banner>
          </div>
        )}

        <div aria-busy={loading}>
          {loading && !data && (
            <div
              className="space-y-3 p-4"
              role="status"
              aria-label="Loading reports"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          )}

          {data && data.items.length === 0 && (
            <EmptyState
              icon={<FolderOpen className="size-10" />}
              title={filtered ? 'No reports match these filters' : copy.empty}
              description={filtered ? undefined : copy.hint}
              action={
                filtered ? (
                  <Button
                    variant="ghost"
                    onClick={() => update({ type: undefined, page: undefined })}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}

          {data && data.items.length > 0 && (
            <ReportsTable
              reports={data.items}
              firstRow={(page - 1) * PAGE_SIZE + 1}
              mode={status === 'PENDING_VERIFICATION' ? 'pending' : 'decided'}
              now={now}
            />
          )}
        </div>

        {data && (
          <div className="p-4 pt-0">
            <Pagination
              page={page}
              limit={PAGE_SIZE}
              total={data.total}
              onChange={(next) =>
                update({ page: next === 1 ? undefined : String(next) })
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}
