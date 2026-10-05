import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  canRunIntegration,
  createTestPrisma,
} from '../../testing/integration.js';
import type { NewNotification } from '../notification.repository.js';
import { PrismaNotificationRepository } from './prisma-notification.repository.js';

const REPORTER = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const OTHER = '11111111-2222-4333-8444-555555555555';
const REPORT_ID = '665f1f77bcf86cd799439011';

function input(n: number, reporterId = REPORTER): NewNotification {
  return {
    reporterId,
    reportId: REPORT_ID,
    kind: 'REPORT_VERIFIED',
    title: `Report verified ${n}`,
    message: `Message ${n}`,
  };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(!canRunIntegration)(
  'PrismaNotificationRepository (integration, dws_test)',
  () => {
    let prisma: PrismaService;
    let repository: PrismaNotificationRepository;

    beforeAll(async () => {
      prisma = createTestPrisma();
      await prisma.onModuleInit();
      repository = new PrismaNotificationRepository(prisma);
    });

    afterAll(async () => {
      await prisma.notification.deleteMany();
      await prisma.onModuleDestroy();
    });

    beforeEach(async () => {
      await prisma.notification.deleteMany();
    });

    it("lists only the reporter's notifications, newest first", async () => {
      await repository.create(input(1));
      await pause(5);
      await repository.create(input(2));
      await repository.create(input(3, OTHER));

      const items = await repository.listByReporter(REPORTER, {
        unreadOnly: false,
        limit: 50,
      });

      expect(items.map((item) => item.title)).toEqual([
        'Report verified 2',
        'Report verified 1',
      ]);
    });

    it('respects the limit', async () => {
      for (const n of [1, 2, 3]) await repository.create(input(n));

      const items = await repository.listByReporter(REPORTER, {
        unreadOnly: false,
        limit: 2,
      });

      expect(items).toHaveLength(2);
    });

    it('marks a notification read and then hides it from the unread list', async () => {
      const created = await repository.create(input(1));
      await repository.create(input(2));

      const read = await repository.markRead(created.id, REPORTER);
      const unread = await repository.listByReporter(REPORTER, {
        unreadOnly: true,
        limit: 50,
      });

      expect(read?.readAt).toBeInstanceOf(Date);
      expect(unread.map((item) => item.title)).toEqual(['Report verified 2']);
    });

    it('keeps the first read time when marked read again', async () => {
      const created = await repository.create(input(1));

      const first = await repository.markRead(created.id, REPORTER);
      await pause(20);
      const second = await repository.markRead(created.id, REPORTER);

      expect(second?.readAt).toEqual(first?.readAt);
    });

    it('does not let another reporter mark it read', async () => {
      const created = await repository.create(input(1));

      expect(await repository.markRead(created.id, OTHER)).toBeNull();

      const [stillUnread] = await repository.listByReporter(REPORTER, {
        unreadOnly: true,
        limit: 50,
      });
      expect(stillUnread?.id).toBe(created.id);
    });

    it('returns null for an unknown or malformed id', async () => {
      expect(await repository.markRead(REPORT_ID, REPORTER)).toBeNull();
      expect(await repository.markRead('nope', REPORTER)).toBeNull();
    });
  },
);
