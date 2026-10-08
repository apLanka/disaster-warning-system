import type { PrismaService } from '../../prisma/prisma.service.js';
import { WARNING_ID } from '../testing/fixtures.js';
import { PrismaNotificationLogRepository } from './prisma-notification-log.repository.js';

describe('PrismaNotificationLogRepository', () => {
  function setup() {
    const prisma = {
      notificationLog: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    return {
      prisma,
      logs: new PrismaNotificationLogRepository(
        prisma as unknown as PrismaService,
      ),
    };
  }

  it('records one attempt', async () => {
    const { prisma, logs } = setup();
    const entry = {
      warningId: WARNING_ID,
      channel: 'SMS' as const,
      kind: 'WARNING' as const,
      outcome: 'SENT' as const,
      message: 'ok',
      recipients: 2,
    };

    await logs.record(entry);

    expect(prisma.notificationLog.create).toHaveBeenCalledWith({ data: entry });
  });

  it('lists the newest attempts for a warning, and nothing for a malformed id', async () => {
    const { prisma, logs } = setup();

    await logs.listForWarning(WARNING_ID, 50);
    expect(prisma.notificationLog.findMany).toHaveBeenCalledWith({
      where: { warningId: WARNING_ID },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    await expect(logs.listForWarning('bad', 50)).resolves.toEqual([]);
    expect(prisma.notificationLog.findMany).toHaveBeenCalledTimes(1);
  });
});
