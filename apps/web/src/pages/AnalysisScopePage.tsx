import { ArrowLeft, FileBarChart } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  districtName,
  EVENT_STATUS_LABELS,
  HAZARD_TYPE_LABELS,
  type DistrictCode,
} from '@repo/types';

import { describeAnalysisError, getEvent } from '../api/analysis';
import { DemoDataNotice } from '../components/analysis/DemoDataNotice';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, INPUT_CLASSES } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { formatPeriod } from '../lib/format';
import { ANALYSIS_PATH, analysisReportPath } from '../lib/routes';

const REPORT_INCLUDES = [
  'Alert timeline',
  'Citizens reached',
  'Shelter occupancy over time',
  'Resource distribution by district',
];

type ScopeKind = 'ALL' | 'DISTRICT';

/** Screen 2: the chosen event, and whether to analyse all its districts or one. */
export function AnalysisScopePage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  usePageTitle('Select analysis scope');

  const {
    data: event,
    error,
    loading,
    reload,
  } = useResource((signal) => getEvent(eventId, signal), [eventId]);

  const [kind, setKind] = useState<ScopeKind>('ALL');
  const [district, setDistrict] = useState<DistrictCode | ''>('');
  const [districtError, setDistrictError] = useState<string>();

  function generate(submitted: FormEvent) {
    submitted.preventDefault();
    if (kind === 'DISTRICT' && district === '') {
      setDistrictError('Select a district');
      return;
    }
    navigate(
      analysisReportPath(eventId, kind === 'DISTRICT' ? district : undefined),
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Select analysis scope</h1>
        <p className="text-muted text-sm">
          Choose which districts the post-disaster report should cover.
        </p>
      </div>

      {error !== null && (
        <Banner
          tone="danger"
          action={
            <Button variant="ghost" onClick={reload}>
              Retry
            </Button>
          }
        >
          {describeAnalysisError(error)}
        </Banner>
      )}

      {loading && !event && error === null && (
        <div role="status" aria-label="Loading event" className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {event && (
        <form onSubmit={generate} className="space-y-4" noValidate>
          {event.isDemoData && <DemoDataNotice />}

          <Card title="Selected event">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted text-xs">Event</dt>
                <dd className="font-semibold">{event.name}</dd>
                <dd className="text-muted font-mono text-xs">
                  {event.eventId}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Hazard type</dt>
                <dd>{HAZARD_TYPE_LABELS[event.hazardType]}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Period</dt>
                <dd>{formatPeriod(event.startedAt, event.endedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Status</dt>
                <dd>{EVENT_STATUS_LABELS[event.status]}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted text-xs">Affected districts</dt>
                <dd>{event.districtCodes.map(districtName).join(', ')}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Scope">
            <fieldset className="space-y-3">
              <legend className="sr-only">Districts to include</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  checked={kind === 'ALL'}
                  onChange={() => {
                    setKind('ALL');
                    setDistrictError(undefined);
                  }}
                />
                All affected districts
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  checked={kind === 'DISTRICT'}
                  onChange={() => setKind('DISTRICT')}
                />
                Specific district
              </label>
              {kind === 'DISTRICT' && (
                <Field
                  label="District"
                  htmlFor="scope-district"
                  required
                  error={districtError}
                >
                  <select
                    id="scope-district"
                    className={INPUT_CLASSES}
                    value={district}
                    aria-invalid={districtError ? true : undefined}
                    aria-describedby={
                      districtError ? 'scope-district-error' : undefined
                    }
                    onChange={(changed) => {
                      setDistrict(changed.target.value as DistrictCode | '');
                      setDistrictError(undefined);
                    }}
                  >
                    <option value="">Select a district</option>
                    {event.districtCodes.map((code) => (
                      <option key={code} value={code}>
                        {districtName(code)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </fieldset>
          </Card>

          <Card title="Report includes">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {REPORT_INCLUDES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>

          <div className="flex justify-between gap-4">
            <Link to={ANALYSIS_PATH}>
              <Button
                variant="ghost"
                tabIndex={-1}
                icon={<ArrowLeft aria-hidden="true" className="size-4" />}
              >
                Back
              </Button>
            </Link>
            <Button
              type="submit"
              icon={<FileBarChart aria-hidden="true" className="size-4" />}
            >
              Generate Report
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
