import type {
  CitizenAlertDto,
  CitizenAlertState,
  DisseminationStatusDto,
  HazardWarningDetailDto,
  HazardWarningDto,
  NotificationLogDto,
} from '@repo/types';

import type { AlertDeliveryEntity } from '../../citizens/citizen.entity.js';
import type {
  DisseminationChannelState,
  HazardWarningEntity,
  NotificationLogEntity,
} from './hazard-warning.entity.js';
import { isActive } from './warning-rules.js';

function iso(date: Date | undefined): string | undefined {
  return date?.toISOString();
}

function toChannelDto(item: DisseminationChannelState): DisseminationStatusDto {
  return {
    channel: item.channel,
    state: item.state,
    recipients: item.recipients,
    delivered: item.delivered,
    attempts: item.attempts,
    lastError: item.lastError,
    sentAt: iso(item.sentAt),
  };
}

/** The officer's view. `now` decides whether the warning is still active. */
export function toHazardWarningDto(
  warning: HazardWarningEntity,
  now: Date,
): HazardWarningDto {
  const { cancellation } = warning;
  return {
    id: warning.id,
    reference: warning.reference,
    hazardType: warning.hazardType,
    level: warning.level,
    description: warning.description,
    additionalInfo: warning.additionalInfo,
    safetyInstructions: warning.safetyInstructions,
    districts: warning.districts,
    validFrom: iso(warning.validFrom),
    validUntil: iso(warning.validUntil),
    sourceReportId: warning.sourceReportId,
    status: warning.status,
    active: isActive(warning, now),
    channels: warning.channels.map(toChannelDto),
    createdBy: warning.createdBy,
    issuedBy: warning.issuedBy,
    issuedAt: iso(warning.issuedAt),
    cancellation: cancellation && {
      cancelledAt: cancellation.cancelledAt.toISOString(),
      cancelledBy: cancellation.cancelledBy,
      reason: cancellation.reason,
    },
    createdAt: warning.createdAt.toISOString(),
    updatedAt: warning.updatedAt.toISOString(),
  };
}

export function toNotificationLogDto(
  log: NotificationLogEntity,
): NotificationLogDto {
  return {
    id: log.id,
    channel: log.channel,
    kind: log.kind,
    outcome: log.outcome,
    message: log.message,
    recipients: log.recipients,
    createdAt: log.createdAt.toISOString(),
  };
}

export function toHazardWarningDetailDto(
  warning: HazardWarningEntity,
  logs: NotificationLogEntity[],
  acknowledged: number,
  now: Date,
): HazardWarningDetailDto {
  return {
    ...toHazardWarningDto(warning, now),
    logs: logs.map(toNotificationLogDto),
    acknowledged,
  };
}

/**
 * The citizen's view. Only issued warnings reach here, so issuedAt and
 * validUntil are always set; officer names and internal notes are left out.
 */
export function toCitizenAlertDto(
  warning: HazardWarningEntity,
  delivery: AlertDeliveryEntity,
  state: CitizenAlertState,
): CitizenAlertDto {
  return {
    id: warning.id,
    reference: warning.reference,
    hazardType: warning.hazardType,
    level: warning.level,
    districts: warning.districts,
    description: warning.description ?? '',
    safetyInstructions: warning.safetyInstructions,
    issuedAt: (warning.issuedAt ?? warning.createdAt).toISOString(),
    validUntil: (warning.validUntil ?? warning.createdAt).toISOString(),
    state,
    cancelReason: warning.cancellation?.reason,
    acknowledgedAt: delivery.acknowledgedAt?.toISOString() ?? null,
  };
}
