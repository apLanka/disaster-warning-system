import {
  CHANNEL_KINDS,
  DISSEMINATION_STUCK_AFTER_MS,
  districtName,
  HAZARD_TYPE_LABELS,
  ISSUED_STATUSES,
  type CitizenAlertState,
  type ChannelKind,
  type District,
  type WarningStatus,
} from '@repo/types';

import type {
  DisseminationChannelState,
  HazardWarningEntity,
  WarningContent,
} from './hazard-warning.entity.js';

/** A failed or never-sent channel can be sent again only from these statuses. */
export const RETRYABLE_STATUSES = [
  'PARTIALLY_DISSEMINATED',
  'PENDING_DISSEMINATION',
] as const satisfies readonly WarningStatus[];

/** How long a citizen keeps seeing a cancelled or expired warning. */
export const CITIZEN_HISTORY_MS = 7 * 24 * 60 * 60 * 1000;

export function isIssued(status: WarningStatus): boolean {
  return (ISSUED_STATUSES as readonly WarningStatus[]).includes(status);
}

export function isActive(
  warning: Pick<HazardWarningEntity, 'status' | 'validUntil'>,
  now: Date,
): boolean {
  return (
    isIssued(warning.status) &&
    warning.validUntil !== undefined &&
    warning.validUntil.getTime() > now.getTime()
  );
}

export function initialChannels(): DisseminationChannelState[] {
  return CHANNEL_KINDS.map((channel) => ({
    channel,
    state: 'PENDING',
    recipients: 0,
    delivered: 0,
    attempts: 0,
  }));
}

/** Keeps channel order fixed and replaces only the channels in `updates`. */
export function mergeChannels(
  current: DisseminationChannelState[],
  updates: DisseminationChannelState[],
): DisseminationChannelState[] {
  const pending = initialChannels();
  return CHANNEL_KINDS.map(
    (kind) =>
      updates.find((item) => item.channel === kind) ??
      current.find((item) => item.channel === kind) ??
      pending.find((item) => item.channel === kind)!,
  );
}

/**
 * The scenario's overall status: all reached (or nobody to reach), some
 * reached (Partially Disseminated), or nothing reached (Pending Dissemination).
 */
export function overallStatus(
  channels: DisseminationChannelState[],
): WarningStatus {
  const sent = channels.some((item) => item.state === 'SENT');
  const unfinished = channels.some(
    (item) => item.state === 'FAILED' || item.state === 'PENDING',
  );
  if (!unfinished) return 'DISSEMINATED';
  return sent ? 'PARTIALLY_DISSEMINATED' : 'PENDING_DISSEMINATION';
}

export function retryableChannels(
  channels: DisseminationChannelState[],
): ChannelKind[] {
  return channels
    .filter((item) => item.state === 'FAILED' || item.state === 'PENDING')
    .map((item) => item.channel);
}

/** Problems that make even a draft invalid. */
export function contentProblems(content: WarningContent): string[] {
  const { validFrom, validUntil } = content;
  if (validFrom && validUntil && validUntil.getTime() <= validFrom.getTime()) {
    return ['validUntil must be after validFrom'];
  }
  return [];
}

/** Everything that stops a warning from being issued, in form order. */
export function issueProblems(content: WarningContent, now: Date): string[] {
  const problems = contentProblems(content);
  if (!content.description) {
    problems.push('description is required to issue a warning');
  }
  if (content.safetyInstructions.length === 0) {
    problems.push('add at least one safety instruction');
  }
  if (!content.validUntil) {
    problems.push('validUntil is required to issue a warning');
  } else if (content.validUntil.getTime() <= now.getTime()) {
    problems.push('validUntil must be in the future');
  }
  return problems;
}

/** What a citizen sees, or null when the warning should not be shown at all. */
export function citizenAlertState(
  warning: HazardWarningEntity,
  now: Date,
): CitizenAlertState | null {
  if (!warning.issuedAt || !warning.validUntil) return null;
  const cutoff = now.getTime() - CITIZEN_HISTORY_MS;

  if (warning.status === 'CANCELLED') {
    const cancelledAt = warning.cancellation?.cancelledAt.getTime() ?? 0;
    return cancelledAt >= cutoff ? 'ALL_CLEAR' : null;
  }
  if (!isIssued(warning.status)) return null;
  if (isActive(warning, now)) return 'ACTIVE';
  return warning.validUntil.getTime() >= cutoff ? 'EXPIRED' : null;
}

export function describeDistricts(districts: District[]): string {
  return districts.map(districtName).join(', ');
}

/** The text every channel carries: short enough for one SMS when the description is short. */
export function warningMessage(warning: HazardWarningEntity): string {
  const hazard = HAZARD_TYPE_LABELS[warning.hazardType];
  return `${warning.level} ${hazard} warning for ${describeDistricts(warning.districts)} (${warning.reference}): ${warning.description ?? ''}`.trim();
}

export function allClearMessage(warning: HazardWarningEntity): string {
  const hazard = HAZARD_TYPE_LABELS[warning.hazardType];
  const reason = warning.cancellation?.reason ?? '';
  return `ALL CLEAR: the ${hazard} warning ${warning.reference} for ${describeDistricts(warning.districts)} has been lifted. ${reason}`.trim();
}

/** Issued, not cancelled, but its valid period is over. */
export function hasExpired(
  warning: Pick<HazardWarningEntity, 'status' | 'validUntil'>,
  now: Date,
): boolean {
  return isIssued(warning.status) && !isActive(warning, now);
}

/** Still DISSEMINATING long after the send should have finished. */
export function isStuck(
  warning: Pick<HazardWarningEntity, 'status' | 'updatedAt'>,
  now: Date,
): boolean {
  return (
    warning.status === 'DISSEMINATING' &&
    now.getTime() - warning.updatedAt.getTime() >= DISSEMINATION_STUCK_AFTER_MS
  );
}
