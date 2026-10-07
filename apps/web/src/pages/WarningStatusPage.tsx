import { ArrowLeft, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import {
  DISSEMINATION_STUCK_AFTER_MS,
  districtName,
  HAZARD_TYPE_LABELS,
  WARNING_LIMITS,
  type HazardWarningDetailDto,
} from '@repo/types';

import { ApiError } from '../api/client';
import {
  cancelWarning,
  describeWarningError,
  getWarning,
  retryWarning,
} from '../api/hazardWarnings';
import { ChannelCard } from '../components/warnings/ChannelCard';
import { DeliveryActivity } from '../components/warnings/DeliveryActivity';
import { LevelChip } from '../components/warnings/LevelChip';
import { WarningStatusChip } from '../components/warnings/WarningStatusChip';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, INPUT_CLASSES } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { useWarningStats } from '../hooks/useWarningStats';
import { formatIncidentTime } from '../lib/format';
import { editWarningPath, WARNINGS_PATH } from '../lib/routes';

export const POLL_MS = 3000;

function isStuck(
  warning: Pick<HazardWarningDetailDto, 'status' | 'updatedAt'>,
): boolean {
  return (
    warning.status === 'DISSEMINATING' &&
    Date.now() - new Date(warning.updatedAt).getTime() >=
      DISSEMINATION_STUCK_AFTER_MS
  );
}
const ISSUED = [
  'DISSEMINATING',
  'DISSEMINATED',
  'PARTIALLY_DISSEMINATED',
  'PENDING_DISSEMINATION',
];
const count = new Intl.NumberFormat('en-GB');

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

/** Screen 3: per-channel delivery, Retry for failures, and Cancel with an All Clear. */
export function WarningStatusPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const {
    data: warning,
    error,
    loading,
    reload,
  } = useResource((signal) => getWarning(id, signal), [id]);
  usePageTitle(warning ? `Warning ${warning.reference}` : 'Warning');

  // While the server is still sending, check again every few seconds. A send
  // that has gone quiet for too long was interrupted: stop and offer Retry.
  const sending = warning?.status === 'DISSEMINATING' && !isStuck(warning);
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [sending, reload]);

  if (loading && !warning) {
    return (
      <div role="status" aria-label="Loading warning" className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }
  if (!warning) {
    const missing = error instanceof ApiError && error.status === 404;
    return missing ? (
      <EmptyState
        icon={<SearchX className="size-10" />}
        title="This warning could not be found."
        action={
          <Link to={WARNINGS_PATH} className="text-orange font-semibold">
            Back to warnings
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
        {describeWarningError(error)}
      </Banner>
    );
  }
  return <WarningStatus warning={warning} notice={notice} reload={reload} />;
}

function WarningStatus({
  warning,
  notice,
  reload,
}: {
  warning: HazardWarningDetailDto;
  notice?: string;
  reload: () => void;
}) {
  const { refresh } = useWarningStats();
  const [retrying, setRetrying] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [cancelling, setCancelling] = useState(false);

  const issued = ISSUED.includes(warning.status);
  const expired = issued && !warning.active;
  const stuck = isStuck(warning);
  // Re-sending or cancelling an expired warning would sound sirens for a hazard that is over.
  const actionable = issued && warning.active;
  const finished = warning.channels.filter(
    (channel) => channel.state !== 'PENDING',
  ).length;
  const push = warning.channels.find((channel) => channel.channel === 'PUSH');

  async function retry() {
    setRetrying(true);
    setFailure(null);
    try {
      await retryWarning(warning.id);
    } catch (error) {
      setFailure(error);
    } finally {
      setRetrying(false);
      reload();
      refresh();
    }
  }

  async function cancel() {
    if (reason.trim().length < WARNING_LIMITS.cancelReasonMin) {
      setReasonError(
        `Give a reason of at least ${WARNING_LIMITS.cancelReasonMin} characters.`,
      );
      return;
    }
    setCancelling(true);
    setFailure(null);
    try {
      await cancelWarning(warning.id, { reason: reason.trim() });
      setCancelOpen(false);
    } catch (error) {
      setCancelOpen(false);
      setFailure(error);
    } finally {
      setCancelling(false);
      reload();
      refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          to={WARNINGS_PATH}
          className="text-muted hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to warnings
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Dissemination Status</h1>
          <LevelChip level={warning.level} />
          <WarningStatusChip warning={warning} />
        </div>
        <p className="text-muted text-sm">
          <span className="font-mono">{warning.reference}</span> ·{' '}
          {HAZARD_TYPE_LABELS[warning.hazardType]} ·{' '}
          {warning.districts.map(districtName).join(', ')}
        </p>
      </div>

      {notice && <Banner tone="success">{notice}</Banner>}
      {failure !== null && (
        <Banner tone="danger">{describeWarningError(failure)}</Banner>
      )}
      {stuck && actionable && (
        <Banner
          tone="warning"
          action={
            <Button variant="ghost" loading={retrying} onClick={retry}>
              Retry sending
            </Button>
          }
        >
          This warning has been sending for over two minutes and may have been
          interrupted. Retry sends it on every channel that has not finished.
        </Banner>
      )}
      {warning.status === 'PARTIALLY_DISSEMINATED' && (
        <Banner tone="warning">
          Some channels could not deliver this warning. Retry them below, or use
          radio or TV as a backup.
        </Banner>
      )}
      {warning.status === 'PENDING_DISSEMINATION' && (
        <Banner tone="danger">
          Notification service is temporarily unavailable. The warning is saved;
          retry each channel when the service is back.
        </Banner>
      )}
      {warning.status === 'DRAFT' && (
        <Banner
          tone="warning"
          action={
            <Link
              to={editWarningPath(warning.id)}
              className="font-semibold underline"
            >
              Edit draft
            </Link>
          }
        >
          This warning is a draft and has not been sent.
        </Banner>
      )}
      {warning.cancellation && (
        <Banner tone="success">
          Cancelled by {warning.cancellation.cancelledBy} on{' '}
          {formatIncidentTime(warning.cancellation.cancelledAt)}:{' '}
          {warning.cancellation.reason}. An All Clear was sent to the same
          districts.
        </Banner>
      )}
      {expired && warning.validUntil && (
        <Banner tone="warning">
          This warning expired on {formatIncidentTime(warning.validUntil)}.
        </Banner>
      )}

      {warning.channels.length > 0 && (
        <>
          <Card title="Dissemination Progress">
            <div className="flex items-center justify-between text-sm">
              <span>
                {finished} of {warning.channels.length} channels finished
              </span>
            </div>
            <div className="bg-neutral-tint mt-2 h-2 overflow-hidden rounded-full">
              <div
                className="bg-orange h-full"
                style={{
                  width: `${(finished / warning.channels.length) * 100}%`,
                }}
              />
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            {warning.channels.map((channel) => (
              <ChannelCard
                key={channel.channel}
                status={channel}
                retrying={retrying}
                onRetry={
                  actionable && warning.status !== 'DISSEMINATING'
                    ? retry
                    : undefined
                }
              />
            ))}
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Live Delivery Activity">
          <DeliveryActivity logs={warning.logs} />
        </Card>
        <Card title="Warning Overview">
          <dl className="space-y-2">
            <Row label="Warning level">
              <LevelChip level={warning.level} />
            </Row>
            <Row label="Hazard type">
              {HAZARD_TYPE_LABELS[warning.hazardType]}
            </Row>
            <Row label="Affected area">
              {warning.districts.map(districtName).join(', ')}
            </Row>
            <Row label="Total recipients">
              {count.format(push?.recipients ?? 0)}
            </Row>
            <Row label="Acknowledged">{count.format(warning.acknowledged)}</Row>
            {warning.issuedAt && (
              <Row label="Started">{formatIncidentTime(warning.issuedAt)}</Row>
            )}
            {warning.validUntil && (
              <Row label="Valid until">
                {formatIncidentTime(warning.validUntil)}
              </Row>
            )}
            {warning.issuedBy && (
              <Row label="Issued by">{warning.issuedBy}</Row>
            )}
            {warning.sourceReportId && (
              <Row label="From report">
                <Link
                  to={`/reports/${warning.sourceReportId}`}
                  className="text-orange underline"
                >
                  View report
                </Link>
              </Row>
            )}
          </dl>
          {actionable && (
            <Button
              variant="danger"
              className="mt-4 w-full"
              onClick={() => setCancelOpen(true)}
            >
              Cancel Warning
            </Button>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this warning?"
        confirmLabel="Send All Clear"
        loading={cancelling}
        onConfirm={cancel}
        onCancel={() => setCancelOpen(false)}
      >
        <p>
          Citizens in {warning.districts.map(districtName).join(', ')} will get
          an All Clear and the warning will leave their phones.
        </p>
        <div className="mt-3">
          <Field
            label="Reason"
            htmlFor="cancel-reason"
            required
            error={reasonError}
            hint="Shown to citizens with the All Clear."
          >
            <textarea
              id="cancel-reason"
              rows={3}
              maxLength={WARNING_LIMITS.cancelReasonMax}
              className={INPUT_CLASSES}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(undefined);
              }}
            />
          </Field>
        </div>
      </ConfirmDialog>
    </div>
  );
}
