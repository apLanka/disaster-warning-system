import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  decided,
  entity,
  fakeRepository as fakeReportRepository,
} from '../hazard-reports/testing/fixtures.js';
import {
  fakeDeliveries,
  fakeLogRepository,
  fakeWarningRepository,
  issuedWarning,
  NOW,
  REPORT_ID,
  WARNING_ID,
} from './testing/fixtures.js';
import { WarningQueriesService } from './warning-queries.service.js';

describe('WarningQueriesService', () => {
  let warnings: ReturnType<typeof fakeWarningRepository>;
  let logs: ReturnType<typeof fakeLogRepository>;
  let deliveries: ReturnType<typeof fakeDeliveries>;
  let reports: ReturnType<typeof fakeReportRepository>;
  let service: WarningQueriesService;

  beforeEach(() => {
    warnings = fakeWarningRepository();
    logs = fakeLogRepository();
    deliveries = fakeDeliveries();
    reports = fakeReportRepository();
    service = new WarningQueriesService(warnings, logs, deliveries, reports);
  });

  it('lists a view with paging', async () => {
    warnings.list.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      limit: 10,
    });
    await service.list('past', 2, 10, NOW);
    expect(warnings.list).toHaveBeenCalledWith({
      view: 'past',
      page: 2,
      limit: 10,
      now: NOW,
    });
  });

  it('counts issued today from midnight in Sri Lanka', async () => {
    warnings.stats.mockResolvedValue({ active: 1, drafts: 0, issuedToday: 1 });
    await service.stats(NOW);
    // 2026-10-07T08:00Z is 13:30 in Colombo; midnight there is 2026-10-06T18:30Z.
    expect(warnings.stats).toHaveBeenCalledWith(
      NOW,
      new Date('2026-10-06T18:30:00.000Z'),
    );
  });

  it('returns a warning with its latest logs and acknowledgement count', async () => {
    warnings.findById.mockResolvedValue(issuedWarning());
    deliveries.countAcknowledged.mockResolvedValue(3);

    const detail = await service.findOne(WARNING_ID);

    expect(detail).toEqual({
      warning: issuedWarning(),
      logs: [],
      acknowledged: 3,
    });
    expect(logs.listForWarning).toHaveBeenCalledWith(WARNING_ID, 50);
  });

  it('404s an unknown warning', async () => {
    warnings.findById.mockResolvedValue(null);
    await expect(service.findOne(WARNING_ID)).rejects.toThrow(
      new NotFoundException('Warning not found'),
    );
  });

  describe('prefill', () => {
    it('builds the form from a verified report, choosing the nearest district', async () => {
      reports.findById.mockResolvedValue(
        decided('VERIFIED', { id: REPORT_ID }),
      );

      await expect(service.prefill(REPORT_ID)).resolves.toEqual({
        hazardType: 'FLOOD',
        districts: ['KANDY'],
        description: 'Water is rising near the bridge',
        sourceReportId: REPORT_ID,
        reportReference: 'HR-2026-0001',
      });
    });

    it('refuses a report that is not verified', async () => {
      reports.findById.mockResolvedValue(entity());
      await expect(service.prefill(REPORT_ID)).rejects.toThrow(
        new BadRequestException(
          'Only verified reports can be escalated to a warning.',
        ),
      );
    });

    it('404s an unknown report', async () => {
      reports.findById.mockResolvedValue(null);
      await expect(service.prefill(REPORT_ID)).rejects.toThrow(
        new NotFoundException('Report not found'),
      );
    });
  });
});
