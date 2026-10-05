import type { HazardReportDto } from '@repo/types';

import type { HazardReportEntity } from './hazard-report.entity.js';

/** The full view, for a Duty Officer. */
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

/**
 * What the reporter sees: the outcome and the reason given to them, but not
 * which officer decided or the officer's internal notes.
 */
export function toReporterReportDto(
  entity: HazardReportEntity,
): HazardReportDto {
  const dto = toHazardReportDto(entity);
  if (!dto.decision) return dto;

  const {
    decidedBy: _decidedBy,
    officerNotes: _officerNotes,
    ...visible
  } = dto.decision;
  return { ...dto, decision: visible };
}
