import { FolderOpen, RefreshCw, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  ANALYSIS_LIMITS,
  DISTRICTS,
  HAZARD_TYPE_LABELS,
  HAZARD_TYPES,
  isDistrictCode,
  type DistrictCode,
  type HazardType,
} from '@repo/types';

import { listEvents } from '../api/analysis';
import { describeError } from '../api/client';
import { DemoDataNotice } from '../components/analysis/DemoDataNotice';
import { EventsTable } from '../components/analysis/EventsTable';
import { Pagination } from '../components/reports/Pagination';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, INPUT_CLASSES } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';

export const EVENTS_PAGE_SIZE = ANALYSIS_LIMITS.pageSizeDefault;

function readHazard(value: string | null): HazardType | undefined {
  return HAZARD_TYPES.find((type) => type === value);
}

function readDistrict(value: string | null): DistrictCode | undefined {
  return value !== null && isDistrictCode(value) ? value : undefined;
}

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** Screen 1: the completed disaster events an officer can analyse. */
export function AnalysisEventsPage() {
  usePageTitle('Analysis & Reports');

  const [params, setParams] = useSearchParams();
  const search = params.get('search')?.trim() ?? '';
  const hazardType = readHazard(params.get('hazardType'));
  const district = readDistrict(params.get('district'));
  const page = readPage(params.get('page'));
  const filtered =
    search !== '' || hazardType !== undefined || district !== undefined;

  // The box holds what is being typed; the URL (and the list) change on submit.
  const [draft, setDraft] = useState(search);

  const { data, error, loading, reload } = useResource(
    (signal) =>
      listEvents(
        {
          search: search || undefined,
          hazardType,
          district,
          page,
          limit: EVENTS_PAGE_SIZE,
        },
        signal,
      ),
    [search, hazardType, district, page],
  );

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  }

  function submitSearch(submitted: FormEvent) {
    submitted.preventDefault();
    update({ search: draft.trim(), page: undefined });
  }

  function clearFilters() {
    setDraft('');
    setParams(new URLSearchParams());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analysis &amp; Reports</h1>
          <p className="text-muted text-sm">
            Completed disaster events available for post-disaster analysis.
          </p>
        </div>
        <Button
          icon={<RefreshCw aria-hidden="true" className="size-4" />}
          loading={loading && data !== null}
          onClick={reload}
        >
          Refresh
        </Button>
      </div>

      {data?.items.some((item) => item.isDemoData) && <DemoDataNotice />}

      <Card className="space-y-4 !p-0">
        <form
          role="search"
          onSubmit={submitSearch}
          className="flex flex-wrap items-end gap-4 p-4"
        >
          <Field label="Search" htmlFor="events-search">
            <input
              id="events-search"
              type="search"
              className={INPUT_CLASSES}
              placeholder="Event name or ID"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
          <Field label="Hazard type" htmlFor="events-hazard">
            <select
              id="events-hazard"
              className={INPUT_CLASSES}
              value={hazardType ?? ''}
              onChange={(event) =>
                update({ hazardType: event.target.value, page: undefined })
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
          <Field label="District" htmlFor="events-district">
            <select
              id="events-district"
              className={INPUT_CLASSES}
              value={district ?? ''}
              onChange={(event) =>
                update({ district: event.target.value, page: undefined })
              }
            >
              <option value="">All districts</option>
              {DISTRICTS.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Button
            type="submit"
            variant="ghost"
            icon={<Search aria-hidden="true" className="size-4" />}
          >
            Search
          </Button>
          {data && (
            <p className="text-muted ml-auto text-sm" aria-live="polite">
              {data.total} {data.total === 1 ? 'event' : 'events'}
            </p>
          )}
        </form>

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
              aria-label="Loading events"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          )}

          {data && data.items.length === 0 && (
            <EmptyState
              icon={<FolderOpen className="size-10" />}
              title={
                filtered
                  ? 'No events match these filters'
                  : 'No completed disaster events are available for analysis'
              }
              description={
                filtered
                  ? undefined
                  : 'Events appear here once a disaster has been closed.'
              }
              action={
                filtered ? (
                  <Button variant="ghost" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}

          {data && data.items.length > 0 && <EventsTable events={data.items} />}
        </div>

        {data && (
          <div className="p-4 pt-0">
            <Pagination
              page={page}
              limit={EVENTS_PAGE_SIZE}
              total={data.total}
              noun="events"
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
