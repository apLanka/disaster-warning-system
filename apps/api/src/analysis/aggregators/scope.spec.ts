import {
  distributionsInScope,
  recordsForShelters,
  scopeDistricts,
  sheltersInScope,
} from './scope.js';
import { distribution, reading, shelter } from '../testing/fixtures.js';

describe('scope helpers', () => {
  it('uses every event district for ALL and just the chosen one otherwise', () => {
    expect(scopeDistricts(['CMB', 'GMP'], { kind: 'ALL' })).toEqual([
      'CMB',
      'GMP',
    ]);
    expect(
      scopeDistricts(['CMB', 'GMP'], { kind: 'DISTRICT', districtCode: 'GMP' }),
    ).toEqual(['GMP']);
  });

  it('keeps only the shelters, readings and distributions of the districts in scope', () => {
    const shelters = [shelter('a', 'CMB'), shelter('b', 'GMP')];
    const inScope = sheltersInScope(shelters, ['GMP']);
    expect(inScope.map((s) => s.id)).toEqual(['b']);
    const records = [reading('a', 0, 1), reading('b', 0, 2)];
    expect(
      recordsForShelters(records, inScope).map((r) => r.shelterId),
    ).toEqual(['b']);
    const rows = [distribution('1', 'CMB', 1), distribution('2', 'GMP', 2)];
    expect(distributionsInScope(rows, ['GMP']).map((r) => r.id)).toEqual(['2']);
  });
});
