import {
  WARNING_LIMITS,
  type District,
  type HazardType,
  type HazardWarningDto,
  type WarningFields,
  type WarningLevel,
  type WarningPrefill,
} from '@repo/types';

/** Form state. Dates are `datetime-local` values in the officer's own time zone. */
export interface WarningForm {
  hazardType: HazardType | '';
  level: WarningLevel | '';
  description: string;
  additionalInfo: string;
  safetyInstructions: string[];
  districts: District[];
  validFrom: string;
  validUntil: string;
  sourceReportId?: string;
  reportReference?: string;
}

export type WarningFormField =
  | 'hazardType'
  | 'level'
  | 'description'
  | 'safetyInstructions'
  | 'districts'
  | 'validUntil';
export type WarningFormErrors = Partial<Record<WarningFormField, string>>;

/** Element ids, in form order, so the first invalid field can be focused. */
export const FIELD_IDS: Record<WarningFormField, string> = {
  hazardType: 'warning-hazard-type',
  level: 'warning-level',
  description: 'warning-description',
  safetyInstructions: 'warning-instruction-0',
  districts: 'district-search',
  validUntil: 'warning-valid-until',
};

/** Carried in router state from the form to the review page and back. */
export interface WarningReviewState {
  form: WarningForm;
  clientRequestId: string;
  draftId?: string;
}

const DEFAULT_HOURS = 12;
const HOUR = 3600_000;
const pad = (value: number) => String(value).padStart(2, '0');

export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromIso(iso: string | undefined): string {
  return iso ? toLocalInput(new Date(iso)) : '';
}

export function emptyForm(now = new Date()): WarningForm {
  return {
    hazardType: '',
    level: '',
    description: '',
    additionalInfo: '',
    safetyInstructions: [''],
    districts: [],
    validFrom: toLocalInput(now),
    validUntil: toLocalInput(new Date(now.getTime() + DEFAULT_HOURS * HOUR)),
  };
}

export function formFromWarning(warning: HazardWarningDto): WarningForm {
  return {
    hazardType: warning.hazardType,
    level: warning.level,
    description: warning.description ?? '',
    additionalInfo: warning.additionalInfo ?? '',
    safetyInstructions:
      warning.safetyInstructions.length > 0 ? warning.safetyInstructions : [''],
    districts: warning.districts,
    validFrom: fromIso(warning.validFrom),
    validUntil: fromIso(warning.validUntil),
    sourceReportId: warning.sourceReportId,
  };
}

/** The officer still chooses the level: a report says what happened, not how dangerous it is. */
export function formFromPrefill(
  prefill: WarningPrefill,
  now = new Date(),
): WarningForm {
  return {
    ...emptyForm(now),
    hazardType: prefill.hazardType,
    description: prefill.description,
    districts: prefill.districts,
    sourceReportId: prefill.sourceReportId,
    reportReference: prefill.reportReference,
  };
}

const filledRows = (rows: string[]) =>
  rows.map((row) => row.trim()).filter((row) => row !== '');

export function validateForm(
  form: WarningForm,
  mode: 'draft' | 'issue',
  now = new Date(),
): WarningFormErrors {
  const errors: WarningFormErrors = {};
  const description = form.description.trim();

  if (form.hazardType === '') errors.hazardType = 'Choose a hazard type.';
  if (form.level === '') errors.level = 'Choose a warning level.';
  if (form.districts.length === 0)
    errors.districts = 'Select at least one affected district.';

  const tooShort =
    description.length > 0 &&
    description.length < WARNING_LIMITS.descriptionMin;
  if (tooShort || (mode === 'issue' && description === '')) {
    errors.description = `Describe the warning in at least ${WARNING_LIMITS.descriptionMin} characters.`;
  }
  if (mode === 'issue' && filledRows(form.safetyInstructions).length === 0) {
    errors.safetyInstructions = 'Add at least one safety instruction.';
  }

  const from = form.validFrom ? new Date(form.validFrom) : undefined;
  const until = form.validUntil ? new Date(form.validUntil) : undefined;
  if (from && until && until <= from) {
    errors.validUntil = 'The end time must be after the start time.';
  } else if (mode === 'issue' && !until) {
    errors.validUntil = 'Set when the warning ends.';
  } else if (mode === 'issue' && until && until <= now) {
    errors.validUntil = 'The end time must be in the future.';
  }
  return errors;
}

/** Call only after validateForm passed: type and level are set by then. */
export function toFields(form: WarningForm): WarningFields {
  const text = (value: string) =>
    value.trim() === '' ? undefined : value.trim();
  const iso = (value: string) =>
    value === '' ? undefined : new Date(value).toISOString();
  return {
    hazardType: form.hazardType as HazardType,
    level: form.level as WarningLevel,
    districts: form.districts,
    description: text(form.description),
    additionalInfo: text(form.additionalInfo),
    safetyInstructions: filledRows(form.safetyInstructions),
    validFrom: iso(form.validFrom),
    validUntil: iso(form.validUntil),
    sourceReportId: form.sourceReportId,
  };
}
