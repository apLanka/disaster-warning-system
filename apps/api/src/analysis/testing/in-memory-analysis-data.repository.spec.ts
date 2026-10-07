import { InMemoryAnalysisDataRepository } from './in-memory-analysis-data.repository.js';

const repo = new InMemoryAnalysisDataRepository();
const list = (q: object = {}) =>
  repo.findCompletedEvents({ page: 1, limit: 50, ...q });

describe('InMemoryAnalysisDataRepository', () => {
  it('lists completed events only, newest first', async () => {
    const { items, total } = await list();
    expect(total).toBe(6);
    expect(items.every((e) => e.status === 'COMPLETED')).toBe(true);
    expect(items.map((e) => e.eventId)[0]).toBe('DE-2026-0006');
    expect(items.map((e) => e.eventId)).not.toContain('DE-2026-0007');
  });

  it('filters by hazard type, district and a search over name and reference', async () => {
    expect((await list({ hazardType: 'LANDSLIDE' })).items).toHaveLength(1);
    expect(
      (await list({ district: 'KAN' })).items.map((e) => e.eventId),
    ).toEqual(['DE-2026-0004']);
    expect((await list({ search: 'kelani' })).total).toBe(1);
    expect((await list({ search: 'de-2026-0003' })).total).toBe(1);
    expect((await list({ search: 'nothing like this' })).total).toBe(0);
  });

  it('pages the results but reports the full total', async () => {
    const page2 = await list({ page: 2, limit: 4 });
    expect(page2.items).toHaveLength(2);
    expect(page2.total).toBe(6);
  });

  it('finds any event by id, including the active one, and null for unknown', async () => {
    const all = await repo.findCompletedEvents({ page: 1, limit: 50 });
    expect((await repo.findEventById(all.items[0]!.id))?.id).toBe(
      all.items[0]!.id,
    );
    expect(await repo.findEventById('000000000000000000000000')).toBeNull();
  });

  it("returns an event's warnings in time order, with reach summed by district", async () => {
    const { items } = await list({ search: 'kelani' });
    const id = items[0]!.id;
    const warnings = await repo.findWarningsByEvent(id);
    expect(warnings).toHaveLength(4);
    const times = warnings.map((w) => w.issuedAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    const all = await repo.countCitizensReached(id);
    const cmb = await repo.countCitizensReached(id, ['CMB']);
    expect(cmb).toBeGreaterThan(0);
    expect(cmb).toBeLessThan(all);
  });

  it('returns shelters, readings and resource distributions with names joined', async () => {
    const { items } = await list({ search: 'kelani' });
    const id = items[0]!.id;
    expect(await repo.findSheltersByEvent(id)).toHaveLength(6);
    expect((await repo.findShelterOccupancyByEvent(id)).length).toBeGreaterThan(
      0,
    );
    const rows = await repo.findResourceDistributions(id);
    expect(rows).toHaveLength(9);
    expect(rows.every((r) => r.resourceName && r.organisationName)).toBe(true);
  });

  it('falls back to placeholder names for a dangling reference', async () => {
    const data = {
      events: [],
      warnings: [],
      shelters: [],
      occupancyRecords: [],
      resources: [],
      organisations: [],
      distributions: [
        {
          id: 'd',
          eventId: 'e',
          districtCode: 'CMB' as const,
          resourceId: 'x',
          organisationId: 'y',
          quantity: 1,
          unit: 'u',
          distributedAt: new Date(),
          syncStatus: 'SYNCED' as const,
        },
      ],
    };
    const [row] = await new InMemoryAnalysisDataRepository(
      data,
    ).findResourceDistributions('e');
    expect(row).toMatchObject({
      resourceName: 'Unknown resource',
      resourceType: 'OTHER',
      organisationName: 'Unknown organisation',
    });
  });
});
