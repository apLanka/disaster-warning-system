import { ArrowLeft, FileSearch } from 'lucide-react';
import { useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import {
  HAZARD_TYPE_LABELS,
  HAZARD_TYPES,
  WARNING_LEVEL_LABELS,
  WARNING_LEVELS,
  WARNING_LIMITS,
  type District,
} from '@repo/types';

import {
  createWarning,
  describeWarningError,
  getPrefill,
  getWarning,
  updateDraft,
} from '../api/hazardWarnings';
import { DistrictMap } from '../components/warnings/DistrictMap';
import { DistrictPicker } from '../components/warnings/DistrictPicker';
import { LevelPicker } from '../components/warnings/LevelPicker';
import { SafetyInstructionsField } from '../components/warnings/SafetyInstructionsField';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, INPUT_CLASSES } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { useWarningStats } from '../hooks/useWarningStats';
import { LEVEL_CLASSES } from '../lib/warningLevels';
import { REVIEW_WARNING_PATH, WARNINGS_PATH } from '../lib/routes';
import {
  emptyForm,
  FIELD_IDS,
  formFromPrefill,
  formFromWarning,
  toFields,
  validateForm,
  type WarningForm,
  type WarningFormErrors,
  type WarningFormField,
  type WarningReviewState,
} from '../lib/warningForm';

const FIELD_ORDER: WarningFormField[] = [
  'hazardType',
  'level',
  'description',
  'safetyInstructions',
  'districts',
  'validUntil',
];

/** Screen 1 for a new warning, a draft (`/warnings/:id/edit`), or a verified report (`?fromReport=`). */
export function WarningFormPage() {
  const { id: draftId } = useParams();
  const [params] = useSearchParams();
  const fromReport = params.get('fromReport');
  const location = useLocation();
  const carried = location.state as Partial<WarningReviewState> | null;

  const source = useResource<WarningForm>(
    async (signal) => {
      if (carried?.form) return carried.form;
      if (draftId) return formFromWarning(await getWarning(draftId, signal));
      if (fromReport)
        return formFromPrefill(await getPrefill(fromReport, signal));
      return emptyForm();
    },
    [draftId, fromReport, location.key],
  );

  usePageTitle(draftId ? 'Edit draft warning' : 'Issue hazard warning');

  if (source.loading && !source.data) {
    return (
      <div
        role="status"
        aria-label="Loading warning form"
        className="grid gap-4 lg:grid-cols-[3fr_2fr]"
      >
        <Skeleton className="h-[32rem]" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (!source.data) {
    return (
      <Banner
        tone="danger"
        action={
          <Button variant="ghost" onClick={source.reload}>
            Retry
          </Button>
        }
      >
        {describeWarningError(source.error)}
      </Banner>
    );
  }
  return (
    <WarningEditor
      key={location.key}
      initial={source.data}
      draftId={draftId}
      issueRequestId={carried?.clientRequestId}
    />
  );
}

interface WarningEditorProps {
  initial: WarningForm;
  draftId?: string;
  issueRequestId?: string;
}

function WarningEditor({
  initial,
  draftId,
  issueRequestId,
}: WarningEditorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useWarningStats();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<WarningFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  // Separate ids: a draft save that timed out must never turn a later issue into a replay of the draft.
  const [issueId] = useState(() => issueRequestId ?? crypto.randomUUID());
  const [draftRequestId] = useState(() => crypto.randomUUID());

  function update<K extends keyof WarningForm>(key: K, value: WarningForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggleDistrict(district: District) {
    update(
      'districts',
      form.districts.includes(district)
        ? form.districts.filter((d) => d !== district)
        : [...form.districts, district],
    );
  }

  function check(mode: 'draft' | 'issue'): boolean {
    const next = validateForm(form, mode);
    setErrors(next);
    const first = FIELD_ORDER.find((field) => next[field]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
    return first === undefined;
  }

  function review() {
    if (!check('issue')) return;
    const state: WarningReviewState = {
      form,
      clientRequestId: issueId,
      draftId,
    };
    // Store the entries on this history entry too, so the browser's own Back
    // button returns to a filled form, not an empty one.
    navigate(location.pathname + location.search, {
      replace: true,
      state: { form, clientRequestId: issueId },
    });
    navigate(REVIEW_WARNING_PATH, { state });
  }

  async function saveDraft() {
    if (!check('draft')) return;
    setSaving(true);
    setFailure(null);
    try {
      const fields = toFields(form);
      const saved = draftId
        ? await updateDraft(draftId, fields)
        : await createWarning({
            ...fields,
            clientRequestId: draftRequestId,
            action: 'DRAFT',
          });
      refresh();
      navigate(`${WARNINGS_PATH}?view=drafts`, {
        state: { notice: `Draft ${saved.reference} saved.` },
      });
    } catch (error) {
      setFailure(error);
    } finally {
      setSaving(false);
    }
  }

  const errorProps = (field: WarningFormField) =>
    errors[field]
      ? {
          'aria-invalid': true,
          'aria-describedby': `${FIELD_IDS[field]}-error`,
        }
      : {};

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
        <h1 className="mt-2 text-2xl font-bold">
          {draftId ? 'Edit Draft Warning' : 'Issue Hazard Warning'}
        </h1>
        <p className="text-muted text-sm">
          Configure and dispatch a public warning to the affected districts.
        </p>
      </div>

      {form.reportReference && (
        <Banner tone="success">
          <span className="inline-flex items-center gap-2">
            <FileSearch aria-hidden="true" className="size-4" />
            Prefilled from verified report {form.reportReference}. Check every
            field and choose the warning level.
          </span>
        </Banner>
      )}
      {failure !== null && (
        <Banner tone="danger">{describeWarningError(failure)}</Banner>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <Card title="Warning Incident Details">
          <div className="space-y-4">
            <Field
              label="Hazard type"
              htmlFor={FIELD_IDS.hazardType}
              required
              error={errors.hazardType}
            >
              <select
                id={FIELD_IDS.hazardType}
                className={INPUT_CLASSES}
                value={form.hazardType}
                {...errorProps('hazardType')}
                onChange={(event) =>
                  update(
                    'hazardType',
                    event.target.value as WarningForm['hazardType'],
                  )
                }
              >
                <option value="">Select hazard type…</option>
                {HAZARD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {HAZARD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>

            <LevelPicker
              value={form.level}
              onChange={(level) => update('level', level)}
              error={errors.level}
            />

            <Field
              label="Description"
              htmlFor={FIELD_IDS.description}
              required
              error={errors.description}
              hint="What is happening and who is at risk."
            >
              <textarea
                id={FIELD_IDS.description}
                rows={4}
                maxLength={WARNING_LIMITS.descriptionMax}
                placeholder="Enter warning description…"
                className={INPUT_CLASSES}
                value={form.description}
                {...errorProps('description')}
                onChange={(event) => update('description', event.target.value)}
              />
            </Field>

            <Field
              label="Additional information"
              htmlFor="warning-additional-info"
              hint="Optional. Shown to officers and on the phone."
            >
              <input
                id="warning-additional-info"
                maxLength={WARNING_LIMITS.additionalInfoMax}
                placeholder="Enter additional details…"
                className={INPUT_CLASSES}
                value={form.additionalInfo}
                onChange={(event) =>
                  update('additionalInfo', event.target.value)
                }
              />
            </Field>

            <SafetyInstructionsField
              value={form.safetyInstructions}
              onChange={(rows) => update('safetyInstructions', rows)}
              error={errors.safetyInstructions}
            />

            <DistrictPicker
              value={form.districts}
              onChange={(districts) => update('districts', districts)}
              error={errors.districts}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valid from" htmlFor="warning-valid-from">
                <input
                  id="warning-valid-from"
                  type="datetime-local"
                  className={INPUT_CLASSES}
                  value={form.validFrom}
                  onChange={(event) => update('validFrom', event.target.value)}
                />
              </Field>
              <Field
                label="Valid until"
                htmlFor={FIELD_IDS.validUntil}
                required
                error={errors.validUntil}
              >
                <input
                  id={FIELD_IDS.validUntil}
                  type="datetime-local"
                  className={INPUT_CLASSES}
                  value={form.validUntil}
                  {...errorProps('validUntil')}
                  onChange={(event) => update('validUntil', event.target.value)}
                />
              </Field>
            </div>

            <div className="border-border flex flex-wrap justify-end gap-3 border-t pt-4">
              <Button variant="ghost" loading={saving} onClick={saveDraft}>
                Save as Draft
              </Button>
              <Button disabled={saving} onClick={review}>
                Review Warning
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Affected Area Map">
          <DistrictMap
            districts={form.districts}
            level={form.level}
            onToggle={toggleDistrict}
          />
          <p className="text-muted mt-3 text-xs font-semibold tracking-wide uppercase">
            Warning level legend
          </p>
          <ul className="mt-1 flex flex-wrap gap-3 text-xs">
            {WARNING_LEVELS.map((level) => (
              <li key={level} className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-full ${LEVEL_CLASSES[level]}`}
                />
                {WARNING_LEVEL_LABELS[level]}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
