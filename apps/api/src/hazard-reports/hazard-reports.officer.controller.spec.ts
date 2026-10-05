import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';

import { createTestApp, type TestApp } from './testing/create-test-app.js';
import {
  decided,
  entity,
  OFFICER_KEY,
  OTHER_REPORTER_ID,
  REPORTER_ID,
} from './testing/fixtures.js';

const ID = '665f1f77bcf86cd799439011';
const officer = {
  'x-officer-key': OFFICER_KEY,
  'x-officer-name': 'Officer Silva',
};

describe('HazardReportsController (officer and shared routes)', () => {
  let app: INestApplication;
  let repository: TestApp['repository'];
  let notifier: TestApp['notifier'];

  beforeEach(async () => {
    ({ app, repository, notifier } = await createTestApp());
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  const http = () => request(app.getHttpServer());

  describe('access control', () => {
    it.each([
      ['GET', '/api/hazard-reports'],
      ['GET', '/api/hazard-reports/stats'],
      ['PATCH', `/api/hazard-reports/${ID}/verify`],
      ['PATCH', `/api/hazard-reports/${ID}/reject`],
    ])('%s %s needs the officer key', async (method, path) => {
      const send = (headers: Record<string, string>) =>
        http()
          [method === 'GET' ? 'get' : 'patch'](path)
          .set(headers)
          .send({ reason: 'DUPLICATE' });

      expect((await send({})).status).toBe(401);
      expect((await send({ 'x-officer-key': 'wrong-key' })).status).toBe(401);
      expect((await send({ 'x-reporter-id': REPORTER_ID })).status).toBe(401);
      expect(repository.decide).not.toHaveBeenCalled();
      expect(repository.list).not.toHaveBeenCalled();
    });

    it('returns the shared error body for a rejected key', async () => {
      const response = await http().get('/api/hazard-reports/stats');

      expect(response.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Officer key required',
      });
    });
  });

  describe('GET /api/hazard-reports/stats', () => {
    it('returns the four counts', async () => {
      const stats = { pending: 12, verifiedToday: 24, rejected: 8, total: 136 };
      repository.stats.mockResolvedValue(stats);

      const response = await http()
        .get('/api/hazard-reports/stats')
        .set(officer);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(stats);
    });

    it('is not mistaken for a report id', async () => {
      repository.stats.mockResolvedValue({
        pending: 0,
        verifiedToday: 0,
        rejected: 0,
        total: 0,
      });

      await http().get('/api/hazard-reports/stats').set(officer);

      expect(repository.findById).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/hazard-reports', () => {
    it('lists reports with the full officer view', async () => {
      repository.list.mockResolvedValue({
        items: [decided('REJECTED')],
        total: 41,
        page: 1,
        limit: 20,
      });

      const response = await http().get('/api/hazard-reports').set(officer);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ total: 41, page: 1, limit: 20 });
      expect(response.body.items[0].decision).toMatchObject({
        decidedBy: 'Officer Silva',
        officerNotes: 'Checked against the gauge readings',
        rejectionReason: 'INSUFFICIENT_INFORMATION',
      });
    });

    it('defaults to newest first, page 1, 20 per page', async () => {
      repository.list.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await http().get('/api/hazard-reports').set(officer);

      expect(repository.list).toHaveBeenCalledWith({
        sort: 'newest',
        page: 1,
        limit: 20,
      });
    });

    it('passes filters, sort, and paging through as typed values', async () => {
      repository.list.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        limit: 5,
      });

      await http()
        .get('/api/hazard-reports')
        .query({
          status: 'PENDING_VERIFICATION',
          type: 'LANDSLIDE',
          sort: 'oldest',
          page: '2',
          limit: '5',
        })
        .set(officer);

      expect(repository.list).toHaveBeenCalledWith({
        status: 'PENDING_VERIFICATION',
        type: 'LANDSLIDE',
        sort: 'oldest',
        page: 2,
        limit: 5,
      });
    });

    it.each([
      ['limit=51', { limit: '51' }, /limit/],
      ['page=0', { page: '0' }, /page/],
      ['sort=random', { sort: 'random' }, /sort/],
      ['status=PENDING_SYNC', { status: 'PENDING_SYNC' }, /status/],
      ['an unknown filter', { reporterId: 'x' }, /reporterId/],
    ])('rejects %s with 400', async (_name, query, message) => {
      const response = await http()
        .get('/api/hazard-reports')
        .query(query)
        .set(officer);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(message);
      expect(repository.list).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/hazard-reports/:id', () => {
    it('shows an officer any report in full', async () => {
      repository.findById.mockResolvedValue(
        decided('VERIFIED', { reporterId: OTHER_REPORTER_ID }),
      );

      const response = await http()
        .get(`/api/hazard-reports/${ID}`)
        .set(officer);

      expect(response.status).toBe(200);
      expect(response.body.decision.officerNotes).toBe(
        'Checked against the gauge readings',
      );
    });

    it('shows a reporter their own report without internal officer details', async () => {
      repository.findById.mockResolvedValue(decided('REJECTED'));

      const response = await http()
        .get(`/api/hazard-reports/${ID}`)
        .set('x-reporter-id', REPORTER_ID);

      expect(response.status).toBe(200);
      expect(response.body.decision).toEqual({
        decidedAt: '2026-10-05T07:00:00.000Z',
        rejectionReason: 'INSUFFICIENT_INFORMATION',
        rejectionDetails: 'Please add a photo',
      });
      expect(JSON.stringify(response.body)).not.toContain('Silva');
      expect(JSON.stringify(response.body)).not.toContain('gauge');
    });

    it("answers 404 when a reporter asks for someone else's report", async () => {
      repository.findById.mockResolvedValue(
        entity({ reporterId: OTHER_REPORTER_ID }),
      );

      const response = await http()
        .get(`/api/hazard-reports/${ID}`)
        .set('x-reporter-id', REPORTER_ID);

      expect(response.status).toBe(404);
    });

    it('answers 404 for an unknown or malformed id', async () => {
      repository.findById.mockResolvedValue(null);

      expect(
        (await http().get(`/api/hazard-reports/${ID}`).set(officer)).status,
      ).toBe(404);
      expect(
        (await http().get('/api/hazard-reports/not-an-id').set(officer)).status,
      ).toBe(404);
    });

    it('needs some identity', async () => {
      expect((await http().get(`/api/hazard-reports/${ID}`)).status).toBe(401);
    });

    it('does not fall back to the reporter id when the officer key is wrong', async () => {
      repository.findById.mockResolvedValue(entity());

      const response = await http()
        .get(`/api/hazard-reports/${ID}`)
        .set({ 'x-officer-key': 'wrong', 'x-reporter-id': REPORTER_ID });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/hazard-reports/:id/verify', () => {
    it('verifies, records the officer, and notifies the reporter', async () => {
      repository.decide.mockResolvedValue({
        outcome: 'DECIDED',
        report: decided('VERIFIED'),
      });

      const response = await http()
        .patch(`/api/hazard-reports/${ID}/verify`)
        .set(officer)
        .send({ notes: 'Matches the gauge' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('VERIFIED');
      expect(repository.decide).toHaveBeenCalledWith(ID, {
        status: 'VERIFIED',
        decidedBy: 'Officer Silva',
        officerNotes: 'Matches the gauge',
      });
      expect(notifier.notifyDecision).toHaveBeenCalledOnce();
    });

    it('works with no body and a default officer name', async () => {
      repository.decide.mockResolvedValue({
        outcome: 'DECIDED',
        report: decided('VERIFIED'),
      });

      const response = await http()
        .patch(`/api/hazard-reports/${ID}/verify`)
        .set('x-officer-key', OFFICER_KEY);

      expect(response.status).toBe(200);
      expect(repository.decide).toHaveBeenCalledWith(
        ID,
        expect.objectContaining({ decidedBy: 'Duty Officer' }),
      );
    });

    it('answers 409 when the report was already reviewed', async () => {
      repository.decide.mockResolvedValue({ outcome: 'ALREADY_DECIDED' });

      const response = await http()
        .patch(`/api/hazard-reports/${ID}/verify`)
        .set(officer);

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('This report was already reviewed');
      expect(notifier.notifyDecision).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown report', async () => {
      repository.decide.mockResolvedValue({ outcome: 'NOT_FOUND' });

      expect(
        (await http().patch(`/api/hazard-reports/${ID}/verify`).set(officer))
          .status,
      ).toBe(404);
    });

    it('still answers 200 when the notification fails', async () => {
      repository.decide.mockResolvedValue({
        outcome: 'DECIDED',
        report: decided('VERIFIED'),
      });
      notifier.notifyDecision.mockRejectedValue(new Error('down'));

      expect(
        (await http().patch(`/api/hazard-reports/${ID}/verify`).set(officer))
          .status,
      ).toBe(200);
    });
  });

  describe('PATCH /api/hazard-reports/:id/reject', () => {
    it('rejects with a reason and notifies the reporter', async () => {
      repository.decide.mockResolvedValue({
        outcome: 'DECIDED',
        report: decided('REJECTED'),
      });

      const response = await http()
        .patch(`/api/hazard-reports/${ID}/reject`)
        .set(officer)
        .send({
          reason: 'INSUFFICIENT_INFORMATION',
          details: 'Please add a photo',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
      expect(repository.decide).toHaveBeenCalledWith(ID, {
        status: 'REJECTED',
        decidedBy: 'Officer Silva',
        officerNotes: undefined,
        rejectionReason: 'INSUFFICIENT_INFORMATION',
        rejectionDetails: 'Please add a photo',
      });
      expect(notifier.notifyDecision).toHaveBeenCalledOnce();
    });

    it.each([
      ['no reason', {}, /reason/],
      ['an unknown reason', { reason: 'BORED' }, /reason/],
      [
        'OTHER without details',
        { reason: 'OTHER' },
        /^details is required when reason is OTHER$/,
      ],
      [
        'OTHER with blank details',
        { reason: 'OTHER', details: '   ' },
        /^details is required when reason is OTHER$/,
      ],
      [
        'an unexpected field',
        { reason: 'DUPLICATE', status: 'VERIFIED' },
        /status/,
      ],
    ])(
      'refuses %s with 400 and decides nothing',
      async (_name, body, message) => {
        const response = await http()
          .patch(`/api/hazard-reports/${ID}/reject`)
          .set(officer)
          .send(body);

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(message);
        expect(repository.decide).not.toHaveBeenCalled();
        expect(notifier.notifyDecision).not.toHaveBeenCalled();
      },
    );

    it('answers 409 when the report was already reviewed', async () => {
      repository.decide.mockResolvedValue({ outcome: 'ALREADY_DECIDED' });

      const response = await http()
        .patch(`/api/hazard-reports/${ID}/reject`)
        .set(officer)
        .send({ reason: 'DUPLICATE' });

      expect(response.status).toBe(409);
      expect(notifier.notifyDecision).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown report', async () => {
      repository.decide.mockResolvedValue({ outcome: 'NOT_FOUND' });

      const response = await http()
        .patch(`/api/hazard-reports/${ID}/reject`)
        .set(officer)
        .send({ reason: 'DUPLICATE' });

      expect(response.status).toBe(404);
    });
  });

  describe('what a reporter may see of their own decided report', () => {
    it('hides officer details on GET /mine', async () => {
      repository.findByReporter.mockResolvedValue([decided('REJECTED')]);

      const response = await http()
        .get('/api/hazard-reports/mine')
        .set('x-reporter-id', REPORTER_ID);

      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body)).not.toContain('Silva');
      expect(JSON.stringify(response.body)).not.toContain('gauge');
      expect(response.body[0].decision.rejectionDetails).toBe(
        'Please add a photo',
      );
    });
  });
});
