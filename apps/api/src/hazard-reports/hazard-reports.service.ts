import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { HazardPhoto, Paginated, ReportStats } from '@repo/types';

import type { Caller } from '../common/auth/caller.js';
import { startOfColomboDay } from '../common/time.js';
import { DECISION_NOTIFIER } from '../notifications/decision-notifier.js';
import type { DecisionNotifier } from '../notifications/decision-notifier.js';
import { PHOTO_STORAGE } from '../storage/photo-storage.js';
import type { PhotoStorage, PhotoUpload } from '../storage/photo-storage.js';
import type { CreateHazardReportDto } from './dto/create-hazard-report.dto.js';
import type { RejectReportDto } from './dto/reject-report.dto.js';
import type { VerifyReportDto } from './dto/verify-report.dto.js';
import type { HazardReportEntity } from './domain/hazard-report.entity.js';
import { HAZARD_REPORT_REPOSITORY } from './hazard-report.repository.js';
import type {
  HazardReportRepository,
  ReportDecisionInput,
  ReportListQuery,
} from './hazard-report.repository.js';

export interface SubmitResult {
  report: HazardReportEntity;
  /** False when this was a replay of a request that was already stored. */
  created: boolean;
}

@Injectable()
export class HazardReportsService {
  private readonly logger = new Logger(HazardReportsService.name);

  constructor(
    @Inject(HAZARD_REPORT_REPOSITORY)
    private readonly reports: HazardReportRepository,
    @Inject(PHOTO_STORAGE) private readonly photos: PhotoStorage,
    @Inject(DECISION_NOTIFIER) private readonly notifier: DecisionNotifier,
  ) {}

  /**
   * Stores a new report as PENDING_VERIFICATION. Safe to repeat: submitting
   * the same clientRequestId again returns the original report and uploads
   * nothing, which is what makes offline replay and client retries harmless.
   */
  async submit(
    reporterId: string,
    dto: CreateHazardReportDto,
    files: PhotoUpload[],
  ): Promise<SubmitResult> {
    const existing = await this.reports.findByClientRequestId(
      dto.clientRequestId,
    );
    if (existing) {
      return {
        report: this.requireOwner(existing, reporterId),
        created: false,
      };
    }

    const uploaded = await this.uploadAll(files);

    try {
      const result = await this.reports.create({
        reporterId,
        clientRequestId: dto.clientRequestId,
        reporterName: dto.reporterName,
        reporterContact: dto.reporterContact,
        type: dto.type,
        description: dto.description,
        location: { latitude: dto.latitude, longitude: dto.longitude },
        photos: uploaded,
      });

      if (!result.created) {
        // Lost a race against an identical request: our uploads are orphans.
        await this.discard(uploaded);
        return {
          report: this.requireOwner(result.report, reporterId),
          created: false,
        };
      }
      return result;
    } catch (error) {
      await this.discard(uploaded);
      throw error;
    }
  }

  findMine(reporterId: string): Promise<HazardReportEntity[]> {
    return this.reports.findByReporter(reporterId);
  }

  list(query: ReportListQuery): Promise<Paginated<HazardReportEntity>> {
    return this.reports.list(query);
  }

  stats(now = new Date()): Promise<ReportStats> {
    return this.reports.stats(startOfColomboDay(now));
  }

  /**
   * An officer can open any report; a reporter only their own. Someone else's
   * report is "not found" rather than "forbidden", so ids cannot be probed.
   */
  async findOne(id: string, caller: Caller): Promise<HazardReportEntity> {
    const report = await this.reports.findById(id);
    const visible =
      report &&
      (caller.kind === 'officer' || report.reporterId === caller.reporterId);
    if (!visible) throw new NotFoundException('Report not found');
    return report;
  }

  verify(
    id: string,
    officerName: string,
    dto: VerifyReportDto,
  ): Promise<HazardReportEntity> {
    return this.decide(id, {
      status: 'VERIFIED',
      decidedBy: officerName,
      officerNotes: dto.notes,
    });
  }

  reject(
    id: string,
    officerName: string,
    dto: RejectReportDto,
  ): Promise<HazardReportEntity> {
    return this.decide(id, {
      status: 'REJECTED',
      decidedBy: officerName,
      officerNotes: dto.notes,
      rejectionReason: dto.reason,
      rejectionDetails: dto.details,
    });
  }

  /** A report is decided exactly once; the repository enforces it, this maps the outcome. */
  private async decide(
    id: string,
    decision: ReportDecisionInput,
  ): Promise<HazardReportEntity> {
    const result = await this.reports.decide(id, decision);

    if (result.outcome === 'NOT_FOUND') {
      throw new NotFoundException('Report not found');
    }
    if (result.outcome === 'ALREADY_DECIDED') {
      throw new ConflictException('This report was already reviewed');
    }

    await this.notify(result.report);
    return result.report;
  }

  /** The decision is final once stored, so a notification failure is logged, not surfaced. */
  private async notify(report: HazardReportEntity): Promise<void> {
    try {
      await this.notifier.notifyDecision(report);
    } catch (error) {
      this.logger.error(
        `Could not notify the reporter of report ${report.reference}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private requireOwner(
    report: HazardReportEntity,
    reporterId: string,
  ): HazardReportEntity {
    if (report.reporterId !== reporterId) {
      throw new ConflictException('This request id is already in use');
    }
    return report;
  }

  /** Uploads every photo, and if any fails removes the ones that succeeded. */
  private async uploadAll(files: PhotoUpload[]): Promise<HazardPhoto[]> {
    const settled = await Promise.allSettled(
      files.map((file) => this.photos.upload(file)),
    );

    const uploaded = settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const failure = settled.find((result) => result.status === 'rejected');
    if (failure) {
      await this.discard(uploaded);
      throw failure.reason;
    }
    return uploaded;
  }

  /** Best effort: a failed cleanup is logged, never allowed to mask the real error. */
  private async discard(photos: HazardPhoto[]): Promise<void> {
    const results = await Promise.allSettled(
      photos.map((photo) => this.photos.remove(photo.publicId)),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn(
          `Could not remove orphaned photo ${photos[index]?.publicId}`,
        );
      }
    });
  }
}
