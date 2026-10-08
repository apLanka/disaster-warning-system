import { describe, expect, it } from 'vitest';

import { NOW, warning } from '../test/fixtures';
import {
  emptyForm,
  formFromPrefill,
  formFromWarning,
  toFields,
  toLocalInput,
  validateForm,
  type WarningForm,
} from './warningForm';

function filled(overrides: Partial<WarningForm> = {}): WarningForm {
  return {
    ...emptyForm(NOW),
    hazardType: 'FLOOD',
    level: 'HIGH',
    description: 'Heavy rainfall expected in low-lying areas',
    safetyInstructions: ['Move to higher ground', '  '],
    districts: ['COLOMBO'],
    ...overrides,
  };
}

describe('warning form', () => {
  it('starts now and lasts 12 hours, with one empty instruction row', () => {
    const form = emptyForm(NOW);
    expect(form.validFrom).toBe(toLocalInput(NOW));
    expect(form.validUntil).toBe(
      toLocalInput(new Date(NOW.getTime() + 12 * 3600_000)),
    );
    expect(form.safetyInstructions).toEqual(['']);
  });

  it('needs only type, level and districts for a draft', () => {
    expect(validateForm(emptyForm(NOW), 'draft', NOW)).toEqual({
      hazardType: 'Choose a hazard type.',
      level: 'Choose a warning level.',
      districts: 'Select at least one affected district.',
    });
    expect(validateForm(filled({ description: '' }), 'draft', NOW)).toEqual({});
  });

  it('needs the description, an instruction and a future end to issue', () => {
    expect(
      validateForm(
        filled({
          description: 'short',
          safetyInstructions: [' '],
          validFrom: '',
          validUntil: toLocalInput(new Date(NOW.getTime() - 60_000)),
        }),
        'issue',
        NOW,
      ),
    ).toEqual({
      description: 'Describe the warning in at least 10 characters.',
      safetyInstructions: 'Add at least one safety instruction.',
      validUntil: 'The end time must be in the future.',
    });
  });

  it('rejects an end before the start in both modes', () => {
    const backwards = filled({
      validFrom: toLocalInput(NOW),
      validUntil: toLocalInput(new Date(NOW.getTime() - 3600_000)),
    });
    expect(validateForm(backwards, 'draft', NOW).validUntil).toBe(
      'The end time must be after the start time.',
    );
  });

  it('turns the form into API fields, dropping blank rows and text', () => {
    const fields = toFields(
      filled({ additionalInfo: '  ', sourceReportId: 'r1' }),
    );
    expect(fields).toMatchObject({
      hazardType: 'FLOOD',
      level: 'HIGH',
      districts: ['COLOMBO'],
      description: 'Heavy rainfall expected in low-lying areas',
      additionalInfo: undefined,
      safetyInstructions: ['Move to higher ground'],
      sourceReportId: 'r1',
    });
    expect(new Date(fields.validUntil!).getTime()).toBe(
      new Date(filled().validUntil).getTime(),
    );
  });

  it('loads a draft and a prefill', () => {
    expect(formFromWarning(warning({ status: 'DRAFT' }))).toMatchObject({
      hazardType: 'FLOOD',
      districts: ['COLOMBO'],
    });
    expect(
      formFromPrefill(
        {
          hazardType: 'LANDSLIDE',
          districts: ['KANDY'],
          description: 'Slope moving',
          sourceReportId: 'r1',
          reportReference: 'HR-2026-0001',
        },
        NOW,
      ),
    ).toMatchObject({
      hazardType: 'LANDSLIDE',
      level: '',
      districts: ['KANDY'],
      reportReference: 'HR-2026-0001',
    });
  });
});
