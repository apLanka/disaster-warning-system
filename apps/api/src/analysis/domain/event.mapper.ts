import type { DisasterEventDto } from '@repo/types';

import type { EventEntity } from './analysis.entities.js';

export function toEventDto(event: EventEntity): DisasterEventDto {
  return {
    id: event.id,
    eventId: event.eventId,
    name: event.name,
    hazardType: event.hazardType,
    districtCodes: event.districtCodes,
    startedAt: event.startedAt.toISOString(),
    endedAt: event.endedAt?.toISOString() ?? null,
    status: event.status,
    isDemoData: event.isDemoData,
    updatedAt: event.updatedAt.toISOString(),
  };
}
