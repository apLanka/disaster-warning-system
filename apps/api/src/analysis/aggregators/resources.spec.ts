import { summariseResources } from './resources.js';
import { distribution } from '../testing/fixtures.js';

describe('summariseResources', () => {
  it('is empty for no records', () => {
    expect(summariseResources([])).toEqual({
      rows: [],
      totalsByDistrict: [],
      districtsReceiving: 0,
    });
  });

  it('totals the quantity per district and counts the districts receiving', () => {
    const result = summariseResources([
      distribution('1', 'GMP', 50),
      distribution('2', 'CMB', 100),
      distribution('3', 'CMB', 20),
    ]);
    expect(result.totalsByDistrict).toEqual([
      { districtCode: 'CMB', quantity: 120 },
      { districtCode: 'GMP', quantity: 50 },
    ]);
    expect(result.districtsReceiving).toBe(2);
  });

  it('lists rows sorted by district and carries the joined names and sync status', () => {
    const result = summariseResources([
      distribution('1', 'GMP', 50, 'PENDING'),
      distribution('2', 'CMB', 100),
    ]);
    expect(result.rows.map((r) => r.districtCode)).toEqual(['CMB', 'GMP']);
    expect(result.rows[1]).toEqual({
      districtCode: 'GMP',
      resourceName: 'Dry Rations',
      resourceType: 'FOOD',
      quantity: 50,
      unit: 'packs',
      organisationName: 'Aid Network',
      syncStatus: 'PENDING',
    });
  });
});
