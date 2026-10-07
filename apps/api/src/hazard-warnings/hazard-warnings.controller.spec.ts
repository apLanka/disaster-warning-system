import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';

import { decided, OFFICER_KEY } from '../hazard-reports/testing/fixtures.js';
import {
  createWarningsApp,
  type WarningsTestApp,
} from './testing/create-warnings-app.js';
import {
  channel,
  citizen,
  CLIENT_REQUEST_ID,
  delivery,
  DEVICE_ID,
  issuedWarning,
  REPORT_ID,
  WARNING_ID,
  warningEntity,
} from './testing/fixtures.js';

const officer = {
  'x-officer-key': OFFICER_KEY,
  'x-officer-name': 'Officer Silva',
};
const citizenHeaders = { 'x-reporter-id': DEVICE_ID };
const future = () => new Date(Date.now() + 12 * 3600_000).toISOString();

function fieldsBody(overrides: Record<string, unknown> = {}) {
  return {
    hazardType: 'FLOOD',
    level: 'HIGH',
    districts: ['COLOMBO'],
    description: 'Heavy rainfall expected in low-lying areas',
    safetyInstructions: ['Move to higher ground immediately'],
    validUntil: future(),
    ...overrides,
  };
}

function issueBody(overrides: Record<string, unknown> = {}) {
  return {
    ...fieldsBody(),
    clientRequestId: CLIENT_REQUEST_ID,
    action: 'ISSUE',
    ...overrides,
  };
}

describe('hazard warning HTTP API', () => {
  let app: INestApplication;
  let t: WarningsTestApp;
  const http = () => request(app.getHttpServer());

  async function start(failing: string[] = []) {
    t = await createWarningsApp(failing);
    app = t.app;
    t.warnings.findByClientRequestId.mockResolvedValue(null);
    t.warnings.findActiveOverlapping.mockResolvedValue([]);
    t.warnings.create.mockImplementation(async (input) => ({
      warning: warningEntity({ ...input, validUntil: input.validUntil }),
      created: true,
    }));
    t.warnings.recordDissemination.mockImplementation(
      async (_id, channels, status) =>
        issuedWarning({ channels, status, validUntil: new Date(future()) }),
    );
    t.directory.findInDistricts.mockResolvedValue([
      { deviceId: DEVICE_ID, district: 'COLOMBO', phone: '+94771234567' },
    ]);
  }

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await start();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('access control', () => {
    it.each([
      ['get', '/api/hazard-warnings'],
      ['get', '/api/hazard-warnings/stats'],
      ['post', '/api/hazard-warnings'],
      ['post', `/api/hazard-warnings/${WARNING_ID}/cancel`],
    ] as const)('%s %s needs the officer key', async (method, path) => {
      expect((await http()[method](path).send({})).status).toBe(401);
      expect(
        (await http()[method](path).set(citizenHeaders).send({})).status,
      ).toBe(401);
    });

    it('citizen routes need a device id', async () => {
      expect((await http().get('/api/alerts/mine')).status).toBe(400);
      expect(
        (await http().put('/api/citizens/me').send({ district: 'KANDY' }))
          .status,
      ).toBe(400);
    });
  });

  describe('POST /api/hazard-warnings', () => {
    it('issues, sends on every channel and returns 201 with the status', async () => {
      const response = await http()
        .post('/api/hazard-warnings')
        .set(officer)
        .send(issueBody());

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        status: 'DISSEMINATED',
        active: true,
      });
      expect(
        response.body.channels.map((c: { state: string }) => c.state),
      ).toEqual(['SENT', 'SENT', 'SENT']);
      expect(t.deliveries.recordDelivered).toHaveBeenCalledWith(WARNING_ID, [
        DEVICE_ID,
      ]);
      expect(t.logs.record).toHaveBeenCalledTimes(3);
    });

    it('records PARTIALLY_DISSEMINATED when the SMS gateway is down', async () => {
      await app.close();
      await start(['SMS']);

      const response = await http()
        .post('/api/hazard-warnings')
        .set(officer)
        .send(issueBody());

      expect(response.body.status).toBe('PARTIALLY_DISSEMINATED');
      expect(response.body.channels[1]).toMatchObject({
        channel: 'SMS',
        state: 'FAILED',
        lastError: 'SMS gateway is unavailable',
      });
    });

    it('returns 200 with the first warning for a replay', async () => {
      t.warnings.findByClientRequestId.mockResolvedValue(issuedWarning());

      const response = await http()
        .post('/api/hazard-warnings')
        .set(officer)
        .send(issueBody());

      expect(response.status).toBe(200);
      expect(t.warnings.create).not.toHaveBeenCalled();
    });

    it('returns 409 for a duplicate active warning, and 201 when forced', async () => {
      t.warnings.findActiveOverlapping.mockResolvedValue([
        issuedWarning({ reference: 'HW-2026-0009' }),
      ]);

      const refused = await http()
        .post('/api/hazard-warnings')
        .set(officer)
        .send(issueBody());
      expect(refused.status).toBe(409);
      expect(refused.body.message).toContain('HW-2026-0009');

      const forced = await http()
        .post('/api/hazard-warnings')
        .set(officer)
        .send(issueBody({ force: true }));
      expect(forced.status).toBe(201);
    });

    it('returns 400 with every missing detail for an incomplete issue', async () => {
      const response = await http()
        .post('/api/hazard-warnings')
        .set(officer)
        .send(issueBody({ description: undefined, safetyInstructions: [] }));

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'description is required to issue a warning; add at least one safety instruction',
      );
    });

    it('rejects unknown fields', async () => {
      const response = await http()
        .post('/api/hazard-warnings')
        .set(officer)
        .send(issueBody({ priority: 1 }));
      expect(response.status).toBe(400);
    });
  });

  it('previews the recipients and duplicates without storing anything', async () => {
    t.directory.countInDistricts.mockResolvedValue({
      total: 0,
      withPhone: 0,
      byDistrict: { COLOMBO: 0 },
    });

    const response = await http()
      .post('/api/hazard-warnings/preview')
      .set(officer)
      .send(fieldsBody());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      recipients: { total: 0, withPhone: 0, byDistrict: { COLOMBO: 0 } },
      duplicates: [],
    });
    expect(t.warnings.create).not.toHaveBeenCalled();
  });

  it('lists, counts and shows warnings', async () => {
    t.warnings.list.mockResolvedValue({
      items: [issuedWarning()],
      total: 1,
      page: 1,
      limit: 20,
    });
    t.warnings.stats.mockResolvedValue({
      active: 1,
      drafts: 2,
      issuedToday: 1,
    });
    t.warnings.findById.mockResolvedValue(issuedWarning());

    expect(
      (await http().get('/api/hazard-warnings?view=drafts').set(officer)).body
        .total,
    ).toBe(1);
    expect(t.warnings.list).toHaveBeenCalledWith(
      expect.objectContaining({ view: 'drafts', page: 1, limit: 20 }),
    );
    expect(
      (await http().get('/api/hazard-warnings/stats').set(officer)).body,
    ).toEqual({ active: 1, drafts: 2, issuedToday: 1 });
    expect(
      (await http().get(`/api/hazard-warnings/${WARNING_ID}`).set(officer))
        .body,
    ).toMatchObject({ logs: [], acknowledged: 0 });
  });

  it('edits and deletes drafts', async () => {
    t.warnings.updateDraft.mockResolvedValue({
      outcome: 'UPDATED',
      warning: warningEntity(),
    });
    t.warnings.deleteDraft.mockResolvedValue('DELETED');
    expect(
      (
        await http()
          .patch(`/api/hazard-warnings/${WARNING_ID}`)
          .set(officer)
          .send(fieldsBody())
      ).status,
    ).toBe(200);
    expect(
      (await http().delete(`/api/hazard-warnings/${WARNING_ID}`).set(officer))
        .status,
    ).toBe(204);
  });

  it('issues a draft, retries failed channels, and cancels', async () => {
    t.warnings.findById.mockResolvedValueOnce(
      warningEntity({ validUntil: new Date(future()) }),
    );
    t.warnings.startDissemination.mockResolvedValue({
      outcome: 'UPDATED',
      warning: warningEntity({ status: 'DISSEMINATING' }),
    });
    expect(
      (
        await http()
          .post(`/api/hazard-warnings/${WARNING_ID}/issue`)
          .set(officer)
          .send({})
      ).status,
    ).toBe(200);

    const partial = issuedWarning({
      status: 'PARTIALLY_DISSEMINATED',
      channels: [
        channel('PUSH'),
        channel('SMS', { state: 'FAILED' }),
        channel('AUDIBLE'),
      ],
    });
    t.warnings.findById.mockResolvedValueOnce(partial);
    t.warnings.startDissemination.mockResolvedValueOnce({
      outcome: 'UPDATED',
      warning: { ...partial, status: 'DISSEMINATING' },
    });
    const retried = await http()
      .post(`/api/hazard-warnings/${WARNING_ID}/retry`)
      .set(officer);
    expect(retried.status).toBe(200);
    expect(retried.body.status).toBe('DISSEMINATED');

    t.warnings.cancel.mockResolvedValue({
      outcome: 'UPDATED',
      warning: issuedWarning({ status: 'CANCELLED' }),
    });
    const cancelled = await http()
      .post(`/api/hazard-warnings/${WARNING_ID}/cancel`)
      .set(officer)
      .send({ reason: 'Water receded' });
    expect(cancelled.status).toBe(200);
    expect(t.logs.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ALL_CLEAR' }),
    );
  });

  it('rejects a cancel without a reason', async () => {
    const response = await http()
      .post(`/api/hazard-warnings/${WARNING_ID}/cancel`)
      .set(officer)
      .send({ reason: '' });
    expect(response.status).toBe(400);
    expect(t.warnings.cancel).not.toHaveBeenCalled();
  });

  it('prefills from a verified report and refuses a pending one', async () => {
    t.reports.findById.mockResolvedValueOnce(
      decided('VERIFIED', { id: REPORT_ID }),
    );
    const ok = await http()
      .get(`/api/hazard-warnings/prefill?reportId=${REPORT_ID}`)
      .set(officer);
    expect(ok.body).toMatchObject({
      districts: ['KANDY'],
      reportReference: 'HR-2026-0001',
    });

    t.reports.findById.mockResolvedValueOnce(decided('REJECTED'));
    const refused = await http()
      .get(`/api/hazard-warnings/prefill?reportId=${REPORT_ID}`)
      .set(officer);
    expect(refused.status).toBe(400);
    expect(refused.body.message).toBe(
      'Only verified reports can be escalated to a warning.',
    );
  });

  describe('citizen routes', () => {
    it('registers a district with a normalised phone, and reads it back', async () => {
      t.directory.register.mockResolvedValue(citizen());
      t.directory.findByDeviceId
        .mockResolvedValueOnce(citizen())
        .mockResolvedValueOnce(null);

      const saved = await http()
        .put('/api/citizens/me')
        .set(citizenHeaders)
        .send({ district: 'COLOMBO', phone: '077-123-4567' });
      expect(saved.status).toBe(200);
      expect(t.directory.register).toHaveBeenCalledWith(
        DEVICE_ID,
        'COLOMBO',
        '+94771234567',
      );

      expect(
        (await http().get('/api/citizens/me').set(citizenHeaders)).body
          .district,
      ).toBe('COLOMBO');
      expect(
        (await http().get('/api/citizens/me').set(citizenHeaders)).status,
      ).toBe(404);
    });

    it('rejects a bad phone number', async () => {
      const response = await http()
        .put('/api/citizens/me')
        .set(citizenHeaders)
        .send({ district: 'COLOMBO', phone: '911' });
      expect(response.status).toBe(400);
    });

    it('lists and acknowledges alerts', async () => {
      const active = issuedWarning({ validUntil: new Date(future()) });
      t.deliveries.listForDevice.mockResolvedValue([delivery()]);
      t.warnings.findByIds.mockResolvedValue([active]);
      t.warnings.findById.mockResolvedValue(active);
      t.deliveries.acknowledge.mockResolvedValue(
        delivery({ acknowledgedAt: new Date() }),
      );

      const list = await http().get('/api/alerts/mine').set(citizenHeaders);
      expect(list.body).toEqual([
        expect.objectContaining({
          id: WARNING_ID,
          state: 'ACTIVE',
          acknowledgedAt: null,
        }),
      ]);

      const ack = await http()
        .post(`/api/alerts/${WARNING_ID}/acknowledge`)
        .set(citizenHeaders);
      expect(ack.status).toBe(200);
      expect(ack.body.acknowledgedAt).not.toBeNull();
    });
  });
});
