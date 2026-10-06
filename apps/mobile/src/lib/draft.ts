import {
  HAZARD_REPORT_LIMITS,
  type GeoLocation,
  type HazardType,
} from '@repo/types';

export interface PickedPhoto {
  uri: string;
  mimeType: string;
  fileName: string;
  /** Bytes, when the picker reports it. */
  fileSize?: number;
}

/** What the citizen has entered so far. Survives going back from the review screen. */
export interface ReportDraft {
  /** One per draft, so retries and offline replays never create a second report. */
  clientRequestId: string;
  type: HazardType | null;
  description: string;
  photos: PickedPhoto[];
  location: GeoLocation | null;
}

export type DraftErrors = Partial<
  Record<'type' | 'description' | 'location', string>
>;

const { descriptionMin, descriptionMax } = HAZARD_REPORT_LIMITS;

export function validateDraft(draft: ReportDraft): DraftErrors {
  const errors: DraftErrors = {};
  const description = draft.description.trim();

  if (draft.type === null) errors.type = 'Choose the type of hazard.';

  if (description.length < descriptionMin) {
    errors.description = `Describe what you see in at least ${descriptionMin} characters.`;
  } else if (description.length > descriptionMax) {
    errors.description = `Keep the description under ${descriptionMax} characters.`;
  }

  if (draft.location === null) {
    errors.location =
      'Your location is needed. Try again, or turn on location services.';
  }
  return errors;
}

/** The first problem to tell the user about, in the order the fields appear. */
export function firstError(errors: DraftErrors): string | undefined {
  return errors.type ?? errors.description ?? errors.location;
}
