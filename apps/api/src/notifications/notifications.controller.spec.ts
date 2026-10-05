import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureApp } from '../app.setup.js';
import {
  OTHER_REPORTER_ID,
  REPORTER_ID,
} from '../hazard-reports/testing/fixtures.js';
import { NOTIFICATION_REPOSITORY } from './notification.repository.js';
import { NotificationService } from './notification.service.js';
import { NotificationsController } from './notifications.controller.js';
import { fakeNotificationRepository, notification } from './testing.js';

const ID = '665f1f77bcf86cd799439021';

describe('NotificationsController', () => {
  let app: INestApplication;
  let repository: ReturnType<typeof fakeNotificationRepository>;

  beforeEach(async () => {
    repository = fakeNotificationRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationService,
        { provide: NOTIFICATION_REPOSITORY, useValue: repository },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('GET /api/notifications', () => {
    it("returns the caller's notifications as DTOs", async () => {
      repository.listByReporter.mockResolvedValue([
        notification({
          kind: 'REPORT_REJECTED',
          title: 'Report rejected',
          readAt: new Date('2026-10-05T08:00:00.000Z'),
        }),
        notification({ id: 'second' }),
      ]);

      const response = await http()
        .get('/api/notifications')
        .set('x-reporter-id', REPORTER_ID);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual({
        id: ID,
        reporterId: REPORTER_ID,
        reportId: '665f1f77bcf86cd799439011',
        kind: 'REPORT_REJECTED',
        title: 'Report rejected',
        message: 'Your hazard report HR-2026-0001 has been verified.',
        readAt: '2026-10-05T08:00:00.000Z',
        createdAt: '2026-10-05T07:00:00.000Z',
      });
      expect(response.body[1].readAt).toBeNull();
    });

    it('returns everything with a default limit of 50', async () => {
      repository.listByReporter.mockResolvedValue([]);

      await http().get('/api/notifications').set('x-reporter-id', REPORTER_ID);

      expect(repository.listByReporter).toHaveBeenCalledWith(REPORTER_ID, {
        unreadOnly: false,
        limit: 50,
      });
    });

    it('can ask for unread only, with a limit', async () => {
      repository.listByReporter.mockResolvedValue([]);

      await http()
        .get('/api/notifications')
        .query({ unread: 'true', limit: '10' })
        .set('x-reporter-id', REPORTER_ID);

      expect(repository.listByReporter).toHaveBeenCalledWith(REPORTER_ID, {
        unreadOnly: true,
        limit: 10,
      });
    });

    it('treats unread=false as everything', async () => {
      repository.listByReporter.mockResolvedValue([]);

      await http()
        .get('/api/notifications')
        .query({ unread: 'false' })
        .set('x-reporter-id', REPORTER_ID);

      expect(repository.listByReporter).toHaveBeenCalledWith(
        REPORTER_ID,
        expect.objectContaining({ unreadOnly: false }),
      );
    });

    it.each([
      ['unread=maybe', { unread: 'maybe' }, /unread/],
      ['unread=1', { unread: '1' }, /unread/],
      ['limit=0', { limit: '0' }, /limit/],
      ['limit=101', { limit: '101' }, /limit/],
      ['limit=abc', { limit: 'abc' }, /limit/],
      ['an unknown parameter', { reporterId: OTHER_REPORTER_ID }, /reporterId/],
    ])('rejects %s with 400', async (_name, query, message) => {
      const response = await http()
        .get('/api/notifications')
        .query(query)
        .set('x-reporter-id', REPORTER_ID);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(message);
      expect(repository.listByReporter).not.toHaveBeenCalled();
    });

    it('asks for the reporter id header', async () => {
      const response = await http().get('/api/notifications');

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/x-reporter-id/);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('marks the notification read and returns it', async () => {
      repository.markRead.mockResolvedValue(
        notification({ readAt: new Date('2026-10-05T08:00:00.000Z') }),
      );

      const response = await http()
        .patch(`/api/notifications/${ID}/read`)
        .set('x-reporter-id', REPORTER_ID);

      expect(response.status).toBe(200);
      expect(response.body.readAt).toBe('2026-10-05T08:00:00.000Z');
      expect(repository.markRead).toHaveBeenCalledWith(ID, REPORTER_ID);
    });

    it("answers 404 for an unknown notification or someone else's", async () => {
      repository.markRead.mockResolvedValue(null);

      const response = await http()
        .patch(`/api/notifications/${ID}/read`)
        .set('x-reporter-id', OTHER_REPORTER_ID);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Notification not found');
    });

    it('asks for the reporter id header', async () => {
      const response = await http().patch(`/api/notifications/${ID}/read`);

      expect(response.status).toBe(400);
      expect(repository.markRead).not.toHaveBeenCalled();
    });
  });
});
