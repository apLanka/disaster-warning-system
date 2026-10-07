import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { districtName, HAZARD_TYPE_LABELS, type District } from '@repo/types';

import {
  createWarning,
  describeWarningError,
  issueDraft,
  previewWarning,
} from '../api/hazardWarnings';
import { LevelChip } from '../components/warnings/LevelChip';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Skeleton } from '../components/ui/Skeleton';
import { config } from '../config';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { useWarningStats } from '../hooks/useWarningStats';
import { formatIncidentTime } from '../lib/format';
import {
  editWarningPath,
  NEW_WARNING_PATH,
  warningPath,
  WARNINGS_PATH,
} from '../lib/routes';
import { toFields, type WarningReviewState } from '../lib/warningForm';

const count = new Intl.NumberFormat('en-GB');

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** Screen 2. Opening it without a form (a refresh or a typed URL) goes back to screen 1. */
export function ReviewWarningPage() {
  const location = useLocation();
  const state = location.state as WarningReviewState | null;
  usePageTitle('Review warning');

  if (!state?.form) return <Navigate to={NEW_WARNING_PATH} replace />;
  return <ReviewWarning state={state} />;
}

function ReviewWarning({ state }: { state: WarningReviewState }) {
  const { form, clientRequestId, draftId } = state;
  const navigate = useNavigate();
  const { refresh } = useWarningStats();
  const fields = useMemo(() => toFields(form), [form]);
  const preview = useResource(
    (signal) => previewWarning(fields, signal),
    [fields],
  );
  const [issueAnyway, setIssueAnyway] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const duplicates = preview.data?.duplicates ?? [];
  const recipients = preview.data?.recipients;
  const blocked = !preview.data || (duplicates.length > 0 && !issueAnyway);
  const areaText = fields.districts.map(districtName).join(', ');

  function back() {
    navigate(draftId ? editWarningPath(draftId) : NEW_WARNING_PATH, {
      state: { form, clientRequestId },
    });
  }

  async function issue() {
    setSending(true);
    setFailure(null);
    const force = duplicates.length > 0 && issueAnyway;
    try {
      const issued = draftId
        ? await issueDraft(draftId, { force })
        : await createWarning({
            ...fields,
            clientRequestId,
            action: 'ISSUE',
            force,
          });
      refresh();
      navigate(warningPath(issued.id), {
        replace: true,
        state: { notice: `Warning ${issued.reference} issued.` },
      });
    } catch (error) {
      // Nothing is lost: the summary stays and the officer can confirm again.
      setConfirming(false);
      setFailure(error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Review Warning</h1>

      {failure !== null && (
        <Banner tone="danger">{describeWarningError(failure)}</Banner>
      )}
      {preview.error !== null && !preview.data && (
        <Banner
          tone="danger"
          action={
            <Button variant="ghost" onClick={preview.reload}>
              Retry
            </Button>
          }
        >
          {describeWarningError(preview.error)}
        </Banner>
      )}
      {recipients?.total === 0 && (
        <Banner tone="warning">
          <p className="font-semibold">
            No registered recipients found for the selected area.
          </p>
          <p>
            Sirens will still sound in these districts. Go back to change the
            area, or confirm to issue anyway.
          </p>
        </Banner>
      )}
      {duplicates.length > 0 && (
        <Banner tone="warning">
          <p>
            An active warning already covers this hazard and area:{' '}
            {duplicates.map((duplicate, index) => (
              <span key={duplicate.id}>
                {index > 0 && ', '}
                <Link
                  to={warningPath(duplicate.id)}
                  className="font-semibold underline"
                >
                  {duplicate.reference}
                </Link>
              </span>
            ))}
            . Cancel that one, or issue this as a separate warning.
          </p>
          <label className="mt-2 flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={issueAnyway}
              onChange={(event) => setIssueAnyway(event.target.checked)}
            />
            Issue anyway: this is a different situation
          </label>
        </Banner>
      )}

      <Card title="Warning Summary">
        <div className="grid gap-6 md:grid-cols-2">
          <dl className="space-y-3">
            <Item label="Hazard type">
              {HAZARD_TYPE_LABELS[fields.hazardType]}
            </Item>
            <Item label="Warning level">
              <LevelChip level={fields.level} />
            </Item>
            <Item label="Affected area">{areaText}</Item>
            <Item label="Issued by">{config.officerName}</Item>
            <Item label="Valid">
              {fields.validFrom
                ? formatIncidentTime(fields.validFrom)
                : 'From issue'}{' '}
              to {fields.validUntil && formatIncidentTime(fields.validUntil)}
            </Item>
          </dl>
          <div className="space-y-3">
            <Item label="Description">{fields.description}</Item>
            {fields.additionalInfo && (
              <Item label="Additional information">
                {fields.additionalInfo}
              </Item>
            )}
            <div>
              <p className="text-muted text-xs">Safety instructions</p>
              <ol className="list-decimal pl-5 text-sm">
                {fields.safetyInstructions?.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ol>
            </div>
            <div className="bg-orange-tint rounded-lg p-4">
              <p className="text-muted text-xs">Total citizens in area</p>
              {recipients ? (
                <>
                  <p className="text-orange text-3xl font-semibold">
                    {count.format(recipients.total)}
                  </p>
                  <ul className="text-muted mt-1 text-xs">
                    {Object.entries(recipients.byDistrict).map(
                      ([district, n]) => (
                        <li key={district}>
                          {districtName(district as District)}:{' '}
                          {count.format(n ?? 0)}
                        </li>
                      ),
                    )}
                  </ul>
                  <p className="text-muted mt-1 text-xs">
                    {count.format(recipients.withPhone)} can also receive SMS.
                  </p>
                </>
              ) : (
                <Skeleton className="mt-1 h-9 w-24" />
              )}
            </div>
          </div>
        </div>
      </Card>

      <p className="flex items-center justify-center gap-2 text-sm font-semibold">
        <AlertTriangle aria-hidden="true" className="text-orange size-4" />
        Are you sure you want to issue this warning?
      </p>
      <div className="flex justify-center gap-3">
        <Button variant="ghost" onClick={back} disabled={sending}>
          Back
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          onClick={() => setDiscarding(true)}
          disabled={sending}
        >
          Cancel
        </Button>
        <Button onClick={() => setConfirming(true)} disabled={blocked}>
          Confirm Warning
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Issue this warning?"
        confirmLabel="Issue warning"
        confirmVariant="primary"
        loading={sending}
        onConfirm={issue}
        onCancel={() => setConfirming(false)}
      >
        It will be sent to {count.format(recipients?.total ?? 0)} registered
        citizens in {areaText} by push notification, SMS and audible alert. A
        sent warning cannot be recalled, only cancelled with an All Clear.
      </ConfirmDialog>
      <ConfirmDialog
        open={discarding}
        title="Discard this warning?"
        confirmLabel="Discard"
        onConfirm={() => navigate(WARNINGS_PATH)}
        onCancel={() => setDiscarding(false)}
      >
        Nothing has been sent.{' '}
        {draftId
          ? 'The saved draft is kept.'
          : 'What you entered will be lost.'}
      </ConfirmDialog>
    </div>
  );
}
