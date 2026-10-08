import { isDistrictCode } from '@repo/types';
import { buildFakeDataset, fakeObjectId } from './build-fake-dataset.js';

const dataset = buildFakeDataset();
const event = (eventId: string) => {
  const found = dataset.events.find((e) => e.eventId === eventId);
  if (!found) throw new Error(`missing ${eventId}`);
  return found;
};
const of = <T extends { eventId: string }>(rows: T[], eventId: string) =>
  rows.filter((r) => r.eventId === event(eventId).id);
const shelterIds = (eventId: string) =>
  new Set(of(dataset.shelters, eventId).map((s) => s.id));

describe('buildFakeDataset', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    expect(buildFakeDataset(5)).toEqual(buildFakeDataset(5));
    expect(buildFakeDataset(5)).not.toEqual(buildFakeDataset(6));
  });

  it('has seven events: six completed and one active, all labelled as demo data', () => {
    expect(dataset.events).toHaveLength(7);
    expect(dataset.events.filter((e) => e.status === 'COMPLETED')).toHaveLength(
      6,
    );
    expect(event('DE-2026-0007').status).toBe('ACTIVE');
    expect(event('DE-2026-0007').endedAt).toBeNull();
    expect(dataset.events.every((e) => e.isDemoData)).toBe(true);
  });

  it('uses valid districts, unique ids that are ObjectId text, and consistent references', () => {
    const everyId = (Object.values(dataset) as Array<Array<{ id: string }>>)
      .flat()
      .map((r) => r.id);
    expect(new Set(everyId).size).toBe(everyId.length);
    expect(everyId.every((i) => /^[0-9a-f]{24}$/.test(i))).toBe(true);
    for (const e of dataset.events) {
      expect(e.districtCodes.every(isDistrictCode)).toBe(true);
    }
    const resourceIds = new Set(dataset.resources.map((r) => r.id));
    const orgIds = new Set(dataset.organisations.map((o) => o.id));
    for (const d of dataset.distributions) {
      expect(resourceIds.has(d.resourceId)).toBe(true);
      expect(orgIds.has(d.organisationId)).toBe(true);
    }
  });

  it('never reaches more citizens than it targets, and stays inside the event districts', () => {
    for (const w of dataset.warnings) {
      const owner = dataset.events.find((e) => e.id === w.eventId)!;
      for (const d of w.districts) {
        expect(d.reached).toBeLessThanOrEqual(d.targeted);
        expect(owner.districtCodes).toContain(d.districtCode);
      }
    }
  });

  describe('each event has the shape it promises', () => {
    it('event 1 is the happy path: four labels, nothing pending, everything consistent', () => {
      const warnings = of(dataset.warnings, 'DE-2026-0001');
      expect(warnings.map((w) => w.label)).toEqual([
        'INITIAL_ALERT',
        'ESCALATION',
        'DISTRICT_UPDATE',
        'FINAL_NOTICE',
      ]);
      // The district update covers only some districts, so scoping narrows the numbers.
      expect(warnings[2]!.districts.length).toBeLessThan(
        warnings[0]!.districts.length,
      );
      expect(of(dataset.shelters, 'DE-2026-0001')).toHaveLength(6);
      const records = of(dataset.occupancyRecords, 'DE-2026-0001');
      expect(records.every((r) => r.syncStatus === 'SYNCED')).toBe(true);
      expect(records.every((r) => r.occupancyCount >= 0)).toBe(true);
      expect(
        of(dataset.distributions, 'DE-2026-0001').every(
          (d) => d.syncStatus === 'SYNCED',
        ),
      ).toBe(true);
    });

    it('event 1 occupancy never exceeds capacity and rises then falls', () => {
      const capacity = new Map(dataset.shelters.map((s) => [s.id, s.capacity]));
      const records = of(dataset.occupancyRecords, 'DE-2026-0001');
      for (const r of records) {
        expect(r.occupancyCount).toBeLessThanOrEqual(
          capacity.get(r.shelterId)!,
        );
      }
      const first = records.filter(
        (r) => r.shelterId === records[0]!.shelterId,
      );
      const counts = first.map((r) => r.occupancyCount);
      const peak = Math.max(...counts);
      expect(counts.indexOf(peak)).toBeGreaterThan(0);
      expect(counts.indexOf(peak)).toBeLessThan(counts.length - 1);
    });

    it('event 2 has pending shelter readings and pending resource records', () => {
      expect(
        of(dataset.occupancyRecords, 'DE-2026-0002').filter(
          (r) => r.syncStatus === 'PENDING',
        ),
      ).toHaveLength(2);
      expect(
        of(dataset.distributions, 'DE-2026-0002').filter(
          (r) => r.syncStatus === 'PENDING',
        ),
      ).toHaveLength(2);
    });

    it('event 3 has warnings and resources but no shelters', () => {
      expect(of(dataset.warnings, 'DE-2026-0003').length).toBeGreaterThan(0);
      expect(of(dataset.distributions, 'DE-2026-0003').length).toBeGreaterThan(
        0,
      );
      expect(of(dataset.shelters, 'DE-2026-0003')).toHaveLength(0);
      expect(of(dataset.occupancyRecords, 'DE-2026-0003')).toHaveLength(0);
      expect(event('DE-2026-0003').hazardType).toBe('STRONG_WINDS');
    });

    it('event 4 has no resource records', () => {
      expect(of(dataset.warnings, 'DE-2026-0004').length).toBeGreaterThan(0);
      expect(
        of(dataset.occupancyRecords, 'DE-2026-0004').length,
      ).toBeGreaterThan(0);
      expect(of(dataset.distributions, 'DE-2026-0004')).toHaveLength(0);
    });

    it('event 5 has nothing recorded at all', () => {
      for (const rows of [
        dataset.warnings,
        dataset.shelters,
        dataset.occupancyRecords,
        dataset.distributions,
      ] as Array<Array<{ eventId: string }>>) {
        expect(of(rows, 'DE-2026-0005')).toHaveLength(0);
      }
    });

    it('event 6 has a negative occupancy and a reading for a shelter that does not exist', () => {
      const records = of(dataset.occupancyRecords, 'DE-2026-0006');
      const known = shelterIds('DE-2026-0006');
      expect(records.some((r) => r.occupancyCount < 0)).toBe(true);
      expect(records.some((r) => !known.has(r.shelterId))).toBe(true);
    });

    it('only event 6 has bad records', () => {
      for (const e of dataset.events.filter(
        (x) => x.eventId !== 'DE-2026-0006',
      )) {
        const known = new Set(
          dataset.shelters.filter((s) => s.eventId === e.id).map((s) => s.id),
        );
        for (const r of dataset.occupancyRecords.filter(
          (x) => x.eventId === e.id,
        )) {
          expect(r.occupancyCount).toBeGreaterThanOrEqual(0);
          expect(known.has(r.shelterId)).toBe(true);
        }
      }
    });

    it('event 7 is active with some data', () => {
      expect(of(dataset.warnings, 'DE-2026-0007').length).toBeGreaterThan(0);
    });
  });
});

describe('fakeObjectId', () => {
  it('pads to 24 hex characters', () => {
    expect(fakeObjectId(255)).toBe('0'.repeat(22) + 'ff');
  });
});
