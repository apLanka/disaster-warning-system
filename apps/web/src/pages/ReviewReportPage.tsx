import { ArrowLeft, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  HAZARD_REPORT_LIMITS,
  HAZARD_TYPE_LABELS,
  type HazardReportDto,
} from '@repo/types';

import { ApiError, describeError } from '../api/client';
import { getReport } from '../api/hazardReports';
import { DecisionPanel } from '../components/reports/DecisionPanel';
import { DecisionSummary } from '../components/reports/DecisionSummary';
import { LocationMap } from '../components/reports/LocationMap';
import { PhotoGallery } from '../components/reports/PhotoGallery';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, INPUT_CLASSES } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusChip } from '../components/ui/StatusChip';
import { useNow } from '../hooks/useNow';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReportStats } from '../hooks/useReportStats';
import { useResource } from '../hooks/useResource';
import { formatIncidentTime, formatRelativeTime } from '../lib/format';
import { listPathFor, PENDING_PATH } from '../lib/routes';

const LOADING_LAYOUT = (
  <div className="space-y-4" role="status" aria-label="Loading report">
    <Skeleton className="h-10 w-72" />
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  </div>
);

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-muted text-xs font-semibold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </>
  );
}

function ReportDetails({
  report,
  now,
}: {
  report: HazardReportDto;
  now: Date;
}) {
  return (
    <dl className="grid grid-cols-[8rem_1fr] items-baseline gap-x-3 gap-y-3">
      <Detail label="Hazard type">{HAZARD_TYPE_LABELS[report.type]}</Detail>
      <Detail label="Description">{report.description}</Detail>
      <Detail label="Submitted by">
        {report.reporterName ?? 'Anonymous citizen'}
      </Detail>
      <Detail label="Contact">
        {report.reporterContact ? (
          <span className="font-mono">{report.reporterContact}</span>
        ) : (
          'Not provided'
        )}
      </Detail>
      <Detail label="Reported">
        {formatIncidentTime(report.createdAt, now)}
      </Detail>
    </dl>
  );
}

export function ReviewReportPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const { refresh } = useReportStats();
  const {
    data: report,
    error,
    loading,
    reload,
  } = useResource((signal) => getReport(id, signal), [id]);
  const [notes, setNotes] = useState('');
  const [conflict, setConflict] = useState(false);

  usePageTitle(report ? `Review ${report.reference}` : 'Review report');

  if (loading && !report) return LOADING_LAYOUT;

  if (!report) {
    const missing = error instanceof ApiError && error.status === 404;
    return missing ? (
      <EmptyState
        icon={<SearchX className="size-10" />}
        title="Report not found"
        description="It may have been removed, or the link is wrong."
        action={
          <Link to={PENDING_PATH} className="text-orange font-semibold">
            Back to pending reports
          </Link>
        }
      />
    ) : (
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
    );
  }

  const pending = report.status === 'PENDING_VERIFICATION';
  const backPath = listPathFor(report.status);

  function handleDecided(message: string) {
    refresh();
    navigate(PENDING_PATH, { state: { notice: message } });
  }

  function handleConflict() {
    setConflict(true);
    reload();
    refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          to={backPath}
          className="text-muted hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to{' '}
          {report.status === 'PENDING_VERIFICATION'
            ? 'pending'
            : report.status.toLowerCase()}{' '}
          reports
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Review Hazard Report</h1>
          <StatusChip status={report.status} />
        </div>
        <p className="text-muted text-sm">
          Report ID: <span className="font-mono">{report.reference}</span> ·
          Submitted {formatRelativeTime(report.createdAt, now)}
        </p>
      </div>

      {conflict && (
        <Banner
          tone="warning"
          action={
            <Link to={PENDING_PATH} className="font-semibold underline">
              Back to pending
            </Link>
          }
        >
          This report was already reviewed by another officer. Showing its
          current state.
        </Banner>
      )}
      {pending && (
        <Banner tone="warning">
          Carefully review the submitted details and evidence before taking
          action.
        </Banner>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card title="1. Report Details">
            <ReportDetails report={report} now={now} />
          </Card>
          <Card title="2. Location">
            <LocationMap location={report.location} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="3. Photo Evidence">
            <PhotoGallery photos={report.photos} />
          </Card>

          {pending && (
            <Card title="4. Officer Notes (Optional)">
              <Field
                label="Notes"
                htmlFor="officer-notes"
                hint="Internal only. The reporter will not see these notes."
              >
                <textarea
                  id="officer-notes"
                  rows={3}
                  maxLength={HAZARD_REPORT_LIMITS.notesMax}
                  placeholder="Add your observations or notes here…"
                  className={INPUT_CLASSES}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>
            </Card>
          )}

          <Card title={pending ? '5. Decision' : 'Decision'}>
            {pending ? (
              <DecisionPanel
                report={report}
                notes={notes}
                onDecided={handleDecided}
                onConflict={handleConflict}
              />
            ) : (
              <DecisionSummary report={report} now={now} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
