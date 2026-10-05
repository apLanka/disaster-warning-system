import type { Notification as NotificationRow } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { PrismaNotificationRepository } from './prisma-notification.repository.js';

const ID = '665f1f77bcf86cd799439021';
const UNREAD = { OR: [{ readAt: null }, { readAt: { isSet: false } }] };
const REPORTER = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function row(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: ID,
    reporterId: REPORTER,
    reportId: '665f1f77bcf86cd799439011',
    kind: 'REPORT_VERIFIED',
    title: 'Report verified',
    message: 'Your hazard report HR-2026-0001 has been verified.',
    readAt: null,
    createdAt: new Date('2026-10-05T07:00:00.000Z'),
    ...overrides,
  };
}

describe('PrismaNotificationRepository', () => {
  let notification: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  let repository: PrismaNotificationRepository;

  beforeEach(() => {
    notification = {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    };
    repository = new PrismaNotificationRepository({
      notification,
    } as unknown as PrismaService);
  });

  it('stores a notification and maps it back', async () => {
    notification.create.mockResolvedValue(row());
    const input = {
      reporterId: REPORTER,
      reportId: '665f1f77bcf86cd799439011',
      kind: 'REPORT_VERIFIED',
      title: 'Report verified',
      message: 'Verified.',
    } as const;

    const created = await repository.create(input);

    expect(notification.create).toHaveBeenCalledWith({ data: input });
    expect(created.id).toBe(ID);
    expect(created.readAt).toBeUndefined();
  });

  describe('listByReporter', () => {
    it("lists the reporter's notifications newest first", async () => {
      notification.findMany.mockResolvedValue([row(), row({ id: 'b' })]);

      const items = await repository.listByReporter(REPORTER, {
        unreadOnly: false,
        limit: 50,
      });

      expect(items).toHaveLength(2);
      expect(notification.findMany).toHaveBeenCalledWith({
        where: { reporterId: REPORTER },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 50,
      });
    });

    it('can ask for unread notifications only', async () => {
      notification.findMany.mockResolvedValue([]);

      await repository.listByReporter(REPORTER, { unreadOnly: true, limit: 5 });

      expect(notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reporterId: REPORTER, ...UNREAD },
          take: 5,
        }),
      );
    });

    it('maps the read time when there is one', async () => {
      const readAt = new Date('2026-10-05T08:00:00.000Z');
      notification.findMany.mockResolvedValue([row({ readAt })]);

      const [item] = await repository.listByReporter(REPORTER, {
        unreadOnly: false,
        limit: 50,
      });

      expect(item?.readAt).toEqual(readAt);
    });
  });

  describe('markRead', () => {
    it('marks only an unread notification that belongs to the reporter', async () => {
      notification.updateMany.mockResolvedValue({ count: 1 });
      notification.findFirst.mockResolvedValue(
        row({ readAt: new Date('2026-10-05T08:00:00.000Z') }),
      );

      const result = await repository.markRead(ID, REPORTER);

      expect(notification.updateMany).toHaveBeenCalledWith({
        where: { id: ID, reporterId: REPORTER, ...UNREAD },
        data: { readAt: expect.any(Date) },
      });
      expect(result?.readAt).toEqual(new Date('2026-10-05T08:00:00.000Z'));
    });

    it('returns the notification unchanged when it was already read', async () => {
      const firstRead = new Date('2026-10-05T08:00:00.000Z');
      notification.updateMany.mockResolvedValue({ count: 0 });
      notification.findFirst.mockResolvedValue(row({ readAt: firstRead }));

      const result = await repository.markRead(ID, REPORTER);

      expect(result?.readAt).toEqual(firstRead);
    });

    it('returns null when nothing matches this reporter', async () => {
      notification.updateMany.mockResolvedValue({ count: 0 });
      notification.findFirst.mockResolvedValue(null);

      expect(await repository.markRead(ID, 'someone-else')).toBeNull();
      expect(notification.findFirst).toHaveBeenCalledWith({
        where: { id: ID, reporterId: 'someone-else' },
      });
    });

    it('returns null for a malformed id without touching the database', async () => {
      expect(await repository.markRead('nope', REPORTER)).toBeNull();
      expect(notification.updateMany).not.toHaveBeenCalled();
      expect(notification.findFirst).not.toHaveBeenCalled();
    });
  });
});
