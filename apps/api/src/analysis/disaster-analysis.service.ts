import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type {
  AnalysisScope,
  DisasterEventDto,
  DistrictCode,
  ListEventsQuery,
  Paginated,
  PostDisasterReportDto,
} from '@repo/types';

import {
  ANALYSIS_DATA_REPOSITORY,
  type AnalysisDataRepository,
} from './analysis-data.repository.js';
import {
  assertConsistent,
  assessCompleteness,
  buildOccupancySeries,
  distributionsInScope,
  peakOccupancy,
  recordsForShelters,
  scopeDistricts,
  sheltersInScope,
  summariseResources,
  summariseShelters,
  summariseWarnings,
} from './aggregators/index.js';
import type { EventEntity } from './domain/analysis.entities.js';
import { toEventDto } from './domain/event.mapper.js';
import { ReportGenerationError } from './report-generation.error.js';

const DEFAULT_PAGE_SIZE = 10;

@Injectable()
export class DisasterAnalysisService {
  private readonly logger = new Logger(DisasterAnalysisService.name);

  constructor(
    @Inject(ANALYSIS_DATA_REPOSITORY)
    private readonly data: AnalysisDataRepository,
  ) {}

  async listCompletedEvents(
    query: ListEventsQuery,
  ): Promise<Paginated<DisasterEventDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const { items, total } = await this.data.findCompletedEvents({
      search: query.search,
      hazardType: query.hazardType,
      district: query.district,
      page,
      limit,
    });
    return { items: items.map(toEventDto), total, page, limit };
  }

  async getEvent(id: string): Promise<DisasterEventDto> {
    return toEventDto(await this.findEventOrThrow(id));
  }

  /**
   * Builds the report on demand: nothing is stored. The request is checked first
   * (404, 409, 400, which the officer can fix); after that any problem, including
   * records that contradict each other, becomes the single generation failure.
   */
  async generateDisasterReport(
    id: string,
    district?: DistrictCode,
  ): Promise<PostDisasterReportDto> {
    const event = await this.findEventOrThrow(id);
    if (event.status !== 'COMPLETED') {
      throw new ConflictException('Only completed events can be analysed');
    }
    if (district && !event.districtCodes.includes(district)) {
      throw new BadRequestException(
        'The district is not affected by this event',
      );
    }
    const scope: AnalysisScope = district
      ? { kind: 'DISTRICT', districtCode: district }
      : { kind: 'ALL' };

    try {
      return await this.buildReport(event, scope);
    } catch (error) {
      this.logger.error(
        `Report for ${event.eventId} failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ReportGenerationError();
    }
  }

  private async findEventOrThrow(id: string): Promise<EventEntity> {
    const event = await this.data.findEventById(id);
    if (!event) throw new NotFoundException('Disaster event not found');
    return event;
  }

  private async buildReport(
    event: EventEntity,
    scope: AnalysisScope,
  ): Promise<PostDisasterReportDto> {
    const districts = scopeDistricts(event.districtCodes, scope);
    const [warnings, shelters, occupancyRecords, distributions, reached] =
      await Promise.all([
        this.data.findWarningsByEvent(event.id),
        this.data.findSheltersByEvent(event.id),
        this.data.findShelterOccupancyByEvent(event.id),
        this.data.findResourceDistributions(event.id),
        this.data.countCitizensReached(event.id, districts),
      ]);

    // The whole event is checked, not just the scope: bad records anywhere mean
    // the data cannot be trusted.
    assertConsistent({ warnings, shelters, occupancyRecords, distributions });

    const scopedShelters = sheltersInScope(shelters, districts);
    const scopedRecords = recordsForShelters(occupancyRecords, scopedShelters);
    const scopedDistributions = distributionsInScope(distributions, districts);

    const alerts = summariseWarnings(warnings, districts);
    const series = buildOccupancySeries(scopedRecords);
    const resources = summariseResources(scopedDistributions);
    const dataStatus = assessCompleteness({
      warningCount: alerts.timeline.length,
      shelterCount: scopedShelters.length,
      occupancyRecords: scopedRecords,
      distributions: scopedDistributions,
    });

    const generatedAt = new Date();
    return {
      reportId: `RPT-${event.eventId}-${scope.kind === 'ALL' ? 'ALL' : scope.districtCode}-${generatedAt.getTime()}`,
      generatedAt: generatedAt.toISOString(),
      event: toEventDto(event),
      scope,
      districtIds: districts,
      citizensReached: reached,
      dataCompletenessStatus: dataStatus.complete ? 'COMPLETE' : 'INCOMPLETE',
      dataStatus,
      summary: {
        alertsIssued: alerts.timeline.length,
        citizensTargeted: alerts.targeted,
        citizensReached: reached,
        reachRate: alerts.targeted === 0 ? 0 : reached / alerts.targeted,
        peakShelterOccupancy: peakOccupancy(series, scopedShelters),
        districtsReceivingResources: resources.districtsReceiving,
      },
      alertTimeline: alerts.timeline,
      shelters: summariseShelters(scopedShelters, scopedRecords),
      occupancyTotalSeries: series,
      resources: resources.rows,
      resourceTotalsByDistrict: resources.totalsByDistrict,
    };
  }
}
