import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  nearestDistrict,
  type Paginated,
  type WarningPrefill,
  type WarningStats,
  type WarningView,
} from '@repo/types';

import { ALERT_DELIVERY_REPOSITORY } from '../citizens/alert-delivery.repository.js';
import type { AlertDeliveryRepository } from '../citizens/alert-delivery.repository.js';
import { startOfColomboDay } from '../common/time.js';
import { HAZARD_REPORT_REPOSITORY } from '../hazard-reports/hazard-report.repository.js';
import type { HazardReportRepository } from '../hazard-reports/hazard-report.repository.js';
import type {
  HazardWarningEntity,
  NotificationLogEntity,
} from './domain/hazard-warning.entity.js';
import { HAZARD_WARNING_REPOSITORY } from './hazard-warning.repository.js';
import type { HazardWarningRepository } from './hazard-warning.repository.js';
import { NOTIFICATION_LOG_REPOSITORY } from './notification-log.repository.js';
import type { NotificationLogRepository } from './notification-log.repository.js';

const LOGS_SHOWN = 50;

export interface WarningDetail {
  warning: HazardWarningEntity;
  logs: NotificationLogEntity[];
  acknowledged: number;
}

/** Read side for the portal: lists, counts, the status page, and the prefill from a report. */
@Injectable()
export class WarningQueriesService {
  constructor(
    @Inject(HAZARD_WARNING_REPOSITORY)
    private readonly warnings: HazardWarningRepository,
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly logs: NotificationLogRepository,
    @Inject(ALERT_DELIVERY_REPOSITORY)
    private readonly deliveries: AlertDeliveryRepository,
    @Inject(HAZARD_REPORT_REPOSITORY)
    private readonly reports: HazardReportRepository,
  ) {}

  list(
    view: WarningView,
    page: number,
    limit: number,
    now = new Date(),
  ): Promise<Paginated<HazardWarningEntity>> {
    return this.warnings.list({ view, page, limit, now });
  }

  stats(now = new Date()): Promise<WarningStats> {
    return this.warnings.stats(now, startOfColomboDay(now));
  }

  async findOne(id: string): Promise<WarningDetail> {
    const warning = await this.warnings.findById(id);
    if (!warning) throw new NotFoundException('Warning not found');
    const [logs, acknowledged] = await Promise.all([
      this.logs.listForWarning(id, LOGS_SHOWN),
      this.deliveries.countAcknowledged(id),
    ]);
    return { warning, logs, acknowledged };
  }

  /** Starts a warning from what a verified citizen report already says (finding UC2). */
  async prefill(reportId: string): Promise<WarningPrefill> {
    const report = await this.reports.findById(reportId);
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'VERIFIED') {
      throw new BadRequestException(
        'Only verified reports can be escalated to a warning.',
      );
    }
    return {
      hazardType: report.type,
      districts: [nearestDistrict(report.location)],
      description: report.description,
      sourceReportId: report.id,
      reportReference: report.reference,
    };
  }
}
