import type { HazardReportDto } from '@repo/types';

import type { HazardReportEntity } from './hazard-report.entity.js';

export function toHazardReportDto(entity: HazardReportEntity): HazardReportDto {
  const { decision } = entity;

  return {
    id: entity.id,
    reference: entity.reference,
    reporterId: entity.reporterId,
    reporterName: entity.reporterName,
    reporterContact: entity.reporterContact,
    type: entity.type,
    description: entity.description,
    location: entity.location,
    photos: entity.photos,
    status: entity.status,
    decision: decision && {
      decidedAt: decision.decidedAt.toISOString(),
      decidedBy: decision.decidedBy,
      officerNotes: decision.officerNotes,
      rejectionReason: decision.rejectionReason,
      rejectionDetails: decision.rejectionDetails,
    },
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
