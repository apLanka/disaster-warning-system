import { firstError, validateDraft, type ReportDraft } from './draft';

const valid: ReportDraft = {
  clientRequestId: '00000000-0000-4000-8000-000000000001',
  type: 'FLOOD',
  description: 'Water is rising near the bridge',
  photos: [],
  location: { latitude: 7.2906, longitude: 80.6337 },
};

describe('validateDraft', () => {
  it('accepts a complete draft, with or without photos', () => {
    expect(validateDraft(valid)).toEqual({});
    expect(
      validateDraft({
        ...valid,
        photos: [
          { uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg' },
        ],
      }),
    ).toEqual({});
  });

  it('requires a hazard type', () => {
    expect(validateDraft({ ...valid, type: null }).type).toBe(
      'Choose the type of hazard.',
    );
  });

  it('requires at least 10 characters, ignoring surrounding spaces', () => {
    expect(
      validateDraft({ ...valid, description: 'Too short' }).description,
    ).toMatch(/at least 10 characters/);
    expect(
      validateDraft({ ...valid, description: `   ${'x'.repeat(9)}   ` })
        .description,
    ).toBeDefined();
    expect(
      validateDraft({ ...valid, description: 'x'.repeat(10) }).description,
    ).toBeUndefined();
  });

  it('allows up to 1000 characters and no more', () => {
    expect(
      validateDraft({ ...valid, description: 'x'.repeat(1000) }).description,
    ).toBeUndefined();
    expect(
      validateDraft({ ...valid, description: 'x'.repeat(1001) }).description,
    ).toMatch(/under 1000 characters/);
  });

  it('requires a location', () => {
    expect(validateDraft({ ...valid, location: null }).location).toMatch(
      /location is needed/,
    );
  });

  it('reports every problem at once', () => {
    const errors = validateDraft({
      ...valid,
      type: null,
      description: '',
      location: null,
    });

    expect(Object.keys(errors)).toEqual(['type', 'description', 'location']);
  });
});

describe('firstError', () => {
  it('returns the earliest field in screen order', () => {
    expect(firstError({ location: 'L', description: 'D' })).toBe('D');
    expect(firstError({ type: 'T', location: 'L' })).toBe('T');
    expect(firstError({ location: 'L' })).toBe('L');
  });

  it('returns nothing when there are no errors', () => {
    expect(firstError({})).toBeUndefined();
  });
});
