import { assessCompleteness } from './completeness.js';

const synced = { syncStatus: 'SYNCED' as const };
const pending = { syncStatus: 'PENDING' as const };
const full = {
  warningCount: 4,
  shelterCount: 2,
  occupancyRecords: [synced, synced],
  distributions: [synced],
};
const kinds = (input: Parameters<typeof assessCompleteness>[0]) =>
  assessCompleteness(input).issues.map((i) => i.kind);

describe('assessCompleteness', () => {
  it('is complete when every section has data and nothing is pending', () => {
    expect(assessCompleteness(full)).toEqual({ complete: true, issues: [] });
  });

  it('flags pending shelter records with a count', () => {
    const result = assessCompleteness({
      ...full,
      occupancyRecords: [synced, pending, pending],
    });
    expect(result.complete).toBe(false);
    expect(result.issues).toEqual([
      {
        kind: 'PENDING_SHELTER_RECORDS',
        message: '2 shelter records pending synchronisation.',
        count: 2,
      },
    ]);
  });

  it('flags pending resource records, in the singular for one', () => {
    const [issue] = assessCompleteness({
      ...full,
      distributions: [pending],
    }).issues;
    expect(issue).toMatchObject({ kind: 'PENDING_RESOURCE_RECORDS', count: 1 });
    expect(issue!.message).toBe('1 resource record pending synchronisation.');
  });

  it('flags a missing section', () => {
    expect(kinds({ ...full, warningCount: 0 })).toEqual(['NO_WARNINGS']);
    expect(kinds({ ...full, distributions: [] })).toEqual(['NO_RESOURCE_DATA']);
    expect(kinds({ ...full, shelterCount: 0, occupancyRecords: [] })).toEqual([
      'NO_SHELTER_DATA',
    ]);
  });

  it('treats shelters without any reading as no shelter data', () => {
    expect(kinds({ ...full, occupancyRecords: [] })).toEqual([
      'NO_SHELTER_DATA',
    ]);
  });

  it('lists every reason when several apply', () => {
    expect(
      kinds({
        warningCount: 0,
        shelterCount: 1,
        occupancyRecords: [pending],
        distributions: [],
      }),
    ).toEqual(['NO_WARNINGS', 'NO_RESOURCE_DATA', 'PENDING_SHELTER_RECORDS']);
  });

  it('reports an empty scope as incomplete in every section', () => {
    expect(
      kinds({
        warningCount: 0,
        shelterCount: 0,
        occupancyRecords: [],
        distributions: [],
      }),
    ).toEqual(['NO_WARNINGS', 'NO_SHELTER_DATA', 'NO_RESOURCE_DATA']);
  });
});
