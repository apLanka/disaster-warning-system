import { NotFoundException } from '@nestjs/common';

import {
  decided,
  entity,
  REPORTER_ID,
} from '../hazard-reports/testing/fixtures.js';
import { NotificationService } from './notification.service.js';
import { fakeNotificationRepository, notification } from './testing.js';

describe('NotificationService', () => {
  let repository: ReturnType<typeof fakeNotificationRepository>;
  let service: NotificationService;

  beforeEach(() => {
    repository = fakeNotificationRepository();
    repository.create.mockResolvedValue(notification());
    service = new NotificationService(repository);
  });

  describe('notifyDecision', () => {
    it('tells the reporter their report was verified', async () => {
      const report = decided('VERIFIED');

      await service.notifyDecision(report);

      expect(repository.create).toHaveBeenCalledExactlyOnceWith({
        reporterId: report.reporterId,
        reportId: report.id,
        kind: 'REPORT_VERIFIED',
        title: 'Report verified',
        message:
          'Your hazard report HR-2026-0001 has been verified by the Disaster Management Centre.',
      });
    });

    it('explains a rejection with the reason and the details written for the reporter', async () => {
      await service.notifyDecision(decided('REJECTED'));

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'REPORT_REJECTED',
          title: 'Report rejected',
          message:
            'Your hazard report HR-2026-0001 was not accepted. Reason: Insufficient information. Please add a photo',
        }),
      );
    });

    it('still explains a rejection that has no details', async () => {
      const report = decided('REJECTED');
      report.decision = { ...report.decision!, rejectionDetails: undefined };

      await service.notifyDecision(report);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Your hazard report HR-2026-0001 was not accepted. Reason: Insufficient information.',
        }),
      );
    });

    it('uses the officer\'s own words when the reason is "other"', async () => {
      const report = decided('REJECTED');
      report.decision = {
        ...report.decision!,
        rejectionReason: 'OTHER',
        rejectionDetails: 'The photo shows a different place',
      };

      await service.notifyDecision(report);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Your hazard report HR-2026-0001 was not accepted. The photo shows a different place',
        }),
      );
    });

    it('falls back to a plain message when no reason was recorded', async () => {
      const report = decided('REJECTED');
      report.decision = {
        decidedAt: report.decision!.decidedAt,
        decidedBy: 'Officer Silva',
      };

      await service.notifyDecision(report);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Your hazard report HR-2026-0001 was not accepted.',
        }),
      );
    });

    it.each(['VERIFIED', 'REJECTED'] as const)(
      'never reveals the officer or their internal notes (%s)',
      async (status) => {
        await service.notifyDecision(decided(status));

        const { message, title } = repository.create.mock.calls[0]![0];
        expect(`${title} ${message}`).not.toContain('Silva');
        expect(`${title} ${message}`).not.toContain('gauge');
      },
    );

    it('refuses to notify about a report that is still pending', async () => {
      await expect(service.notifyDecision(entity())).rejects.toThrow(
        /has not been decided/,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('lets a storage failure reach the caller', async () => {
      repository.create.mockRejectedValue(new Error('atlas unreachable'));

      await expect(service.notifyDecision(decided('VERIFIED'))).rejects.toThrow(
        'atlas unreachable',
      );
    });
  });

  describe('listForReporter', () => {
    it("returns the reporter's notifications using the given options", async () => {
      const items = [notification(), notification({ id: 'other' })];
      repository.listByReporter.mockResolvedValue(items);

      const result = await service.listForReporter(REPORTER_ID, {
        unreadOnly: true,
        limit: 10,
      });

      expect(result).toBe(items);
      expect(repository.listByReporter).toHaveBeenCalledWith(REPORTER_ID, {
        unreadOnly: true,
        limit: 10,
      });
    });
  });

  describe('markRead', () => {
    it('returns the notification once marked', async () => {
      const read = notification({
        readAt: new Date('2026-10-05T08:00:00.000Z'),
      });
      repository.markRead.mockResolvedValue(read);

      expect(await service.markRead('id', REPORTER_ID)).toBe(read);
      expect(repository.markRead).toHaveBeenCalledWith('id', REPORTER_ID);
    });

    it('says not found when it does not exist or belongs to someone else', async () => {
      repository.markRead.mockResolvedValue(null);

      await expect(service.markRead('id', REPORTER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
