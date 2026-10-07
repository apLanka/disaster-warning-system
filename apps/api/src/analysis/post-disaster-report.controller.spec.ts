import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import type { PostDisasterReportDto } from '@repo/types';

import {
  ANALYSIS_OFFICER_KEY,
  createAnalysisTestApp,
  type AnalysisTestApp,
} from './testing/create-test-app.js';

const officer = { 'x-officer-key': ANALYSIS_OFFICER_KEY };

describe('PostDisasterReportController', () => {
  let app: INestApplication;
  let idOf: AnalysisTestApp['idOf'];
  let logged: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    ({ app, idOf } = await createAnalysisTestApp());
  });
  afterAll(() => app.close());
  beforeEach(() => {
    logged = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  const get = (path: string, headers: Record<string, string> = officer) =>
    request(app.getHttpServer())
      .get(`/api/disaster-events${path}`)
      .set(headers);
  const report = async (eventId: string, district?: string) => {
    const res = await get(
      `/${idOf(eventId)}/report${district ? `?district=${district}` : ''}`,
    );
    return { res, body: res.body as PostDisasterReportDto };
  };

  describe('access control', () => {
    it.each([
      '',
      '/000000000000000000000000',
      '/000000000000000000000000/report',
    ])('GET %s needs the officer key', async (path) => {
      expect((await get(path, {})).status).toBe(401);
      expect((await get(path, { 'x-officer-key': 'wrong' })).status).toBe(401);
    });
  });

  describe('GET /disaster-events', () => {
    it('lists the six completed events and never the active one', async () => {
      const res = await get('');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(6);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
      expect(
        res.body.items.map((e: { eventId: string }) => e.eventId),
      ).not.toContain('DE-2026-0007');
      expect(res.body.items[0]).toMatchObject({
        status: 'COMPLETED',
        isDemoData: true,
      });
    });

    it('filters by hazard type, district and search, and pages', async () => {
      expect((await get('?hazardType=LANDSLIDE')).body.total).toBe(1);
      expect((await get('?district=CMB')).body.total).toBe(1);
      expect((await get('?search=flood')).body.total).toBe(3);
      const page = await get('?page=2&limit=4');
      expect(page.body.items).toHaveLength(2);
      expect(page.body.total).toBe(6);
    });

    it.each([
      '?page=0',
      '?limit=0',
      '?limit=51',
      '?hazardType=TORNADO',
      '?district=XXX',
    ])('rejects %s', async (query) => {
      expect((await get(query)).status).toBe(400);
    });
  });

  describe('GET /disaster-events/:id', () => {
    it('returns the event, including the active one', async () => {
      const res = await get(`/${idOf('DE-2026-0007')}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        eventId: 'DE-2026-0007',
        status: 'ACTIVE',
        endedAt: null,
      });
    });

    it('is 404 for an unknown or malformed id', async () => {
      expect((await get('/000000000000000000000000')).status).toBe(404);
      expect((await get('/not-an-id')).status).toBe(404);
    });
  });

  describe('GET /disaster-events/:id/report', () => {
    it('event 1 is complete for all districts', async () => {
      const { res, body } = await report('DE-2026-0001');
      expect(res.status).toBe(200);
      expect(body.scope).toEqual({ kind: 'ALL' });
      expect(body.districtIds).toEqual(['CMB', 'GMP', 'KAL']);
      expect(body.dataCompletenessStatus).toBe('COMPLETE');
      expect(body.dataStatus).toEqual({ complete: true, issues: [] });
      expect(body.alertTimeline.map((a) => a.label)).toEqual([
        'INITIAL_ALERT',
        'ESCALATION',
        'DISTRICT_UPDATE',
        'FINAL_NOTICE',
      ]);
      expect(body.summary.alertsIssued).toBe(4);
      expect(body.citizensReached).toBe(body.summary.citizensReached);
      expect(body.citizensReached).toBe(
        body.alertTimeline.reduce((sum, a) => sum + a.reached, 0),
      );
      expect(body.summary.reachRate).toBeGreaterThan(0.8);
      expect(body.summary.reachRate).toBeLessThanOrEqual(1);
      expect(body.shelters).toHaveLength(6);
      expect(body.summary.peakShelterOccupancy).toMatchObject({
        capacity: expect.any(Number),
      });
      expect(body.summary.districtsReceivingResources).toBe(3);
      expect(body.resourceTotalsByDistrict).toHaveLength(3);
      expect(body.event.isDemoData).toBe(true);
      expect(body.reportId).toMatch(/^RPT-DE-2026-0001-ALL-\d+$/);
    });

    it('event 1 narrows every number when scoped to one district', async () => {
      const all = (await report('DE-2026-0001')).body;
      for (const district of ['CMB', 'GMP', 'KAL']) {
        const one = (await report('DE-2026-0001', district)).body;
        expect(one.scope).toEqual({ kind: 'DISTRICT', districtCode: district });
        expect(one.districtIds).toEqual([district]);
        expect(one.citizensReached).toBeLessThan(all.citizensReached);
        expect(one.shelters).toHaveLength(2);
        expect(one.shelters.every((s) => s.districtCode === district)).toBe(
          true,
        );
        expect(one.resources.every((r) => r.districtCode === district)).toBe(
          true,
        );
        expect(one.summary.districtsReceivingResources).toBe(1);
        expect(one.dataCompletenessStatus).toBe('COMPLETE');
      }
      // The district update covers only Colombo and Gampaha.
      expect(
        (await report('DE-2026-0001', 'KAL')).body.alertTimeline,
      ).toHaveLength(3);
      expect(
        (await report('DE-2026-0001', 'CMB')).body.alertTimeline,
      ).toHaveLength(4);
      // The per-district reach adds back up to the whole.
      const parts = await Promise.all(
        ['CMB', 'GMP', 'KAL'].map(
          async (d) => (await report('DE-2026-0001', d)).body.citizensReached,
        ),
      );
      expect(parts.reduce((a, b) => a + b, 0)).toBe(all.citizensReached);
    });

    it('event 2 is incomplete because records are pending synchronisation', async () => {
      const { res, body } = await report('DE-2026-0002');
      expect(res.status).toBe(200);
      expect(body.dataCompletenessStatus).toBe('INCOMPLETE');
      expect(body.dataStatus.issues).toEqual([
        expect.objectContaining({ kind: 'PENDING_SHELTER_RECORDS', count: 2 }),
        expect.objectContaining({ kind: 'PENDING_RESOURCE_RECORDS', count: 2 }),
      ]);
      expect(
        body.resources.filter((r) => r.syncStatus === 'PENDING'),
      ).toHaveLength(2);
      expect(body.shelters.reduce((sum, s) => sum + s.pendingRecords, 0)).toBe(
        2,
      );
    });

    it('event 3 is incomplete with no shelter data but still reports the rest', async () => {
      const { body } = await report('DE-2026-0003');
      expect(body.dataStatus.issues.map((i) => i.kind)).toEqual([
        'NO_SHELTER_DATA',
      ]);
      expect(body.shelters).toEqual([]);
      expect(body.occupancyTotalSeries).toEqual([]);
      expect(body.summary.peakShelterOccupancy).toBeNull();
      expect(body.summary.alertsIssued).toBe(4);
      expect(body.resources.length).toBeGreaterThan(0);
    });

    it('event 4 is incomplete with no resource data, and a district with none says so', async () => {
      const { body } = await report('DE-2026-0004');
      expect(body.dataStatus.issues.map((i) => i.kind)).toEqual([
        'NO_RESOURCE_DATA',
      ]);
      expect(body.summary.districtsReceivingResources).toBe(0);
      const one = (await report('DE-2026-0004', 'KAN')).body;
      expect(one.dataStatus.issues.map((i) => i.kind)).toEqual([
        'NO_RESOURCE_DATA',
      ]);
    });

    it('event 5 is a valid report that is empty and incomplete in every section', async () => {
      const { res, body } = await report('DE-2026-0005');
      expect(res.status).toBe(200);
      expect(body.dataStatus.issues.map((i) => i.kind)).toEqual([
        'NO_WARNINGS',
        'NO_SHELTER_DATA',
        'NO_RESOURCE_DATA',
      ]);
      expect(body.summary).toEqual({
        alertsIssued: 0,
        citizensTargeted: 0,
        citizensReached: 0,
        reachRate: 0,
        peakShelterOccupancy: null,
        districtsReceivingResources: 0,
      });
    });

    it('event 6 fails with 503 and no report body, and logs the cause', async () => {
      for (const district of [undefined, 'BTC']) {
        const { res, body } = await report('DE-2026-0006', district);
        expect(res.status).toBe(503);
        expect(res.body).toEqual({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Report generation failed. Please try again.',
        });
        expect(body.summary).toBeUndefined();
      }
      expect(logged).toHaveBeenCalledWith(
        expect.stringContaining('Inconsistent records'),
        expect.anything(),
      );
    });

    it('an active event gives 409', async () => {
      const { res } = await report('DE-2026-0007');
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Only completed events can be analysed');
    });

    it('an unknown event gives 404', async () => {
      const res = await get('/000000000000000000000000/report');
      expect(res.status).toBe(404);
    });

    it('a district the event does not affect gives 400, and an invalid code gives 400', async () => {
      expect((await report('DE-2026-0001', 'JAF')).res.status).toBe(400);
      expect((await report('DE-2026-0001', 'XXX')).res.status).toBe(400);
    });

    it('treats a blank district as all districts', async () => {
      const res = await get(`/${idOf('DE-2026-0001')}/report?district=%20`);
      expect(res.status).toBe(200);
      expect(res.body.scope).toEqual({ kind: 'ALL' });
    });
  });
});
