import type {
  HazardReportDto,
  HazardWarningDetailDto,
  HazardWarningDto,
  Paginated,
  ReportStats,
  WarningPreview,
  WarningStats,
} from '@repo/types';

export const NOW = new Date('2026-10-05T10:00:00.000Z');

export function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

export function report(
  overrides: Partial<HazardReportDto> = {},
): HazardReportDto {
  return {
    id: '665f1f77bcf86cd799439011',
    reference: 'HR-2026-0412',
    reporterId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    reporterName: 'Nimal Perera',
    reporterContact: '+94 77 123 4567',
    type: 'RISING_RIVER_LEVEL',
    description:
      'Water level of Mahaweli river is rising rapidly near Peradeniya bridge.',
    location: { latitude: 7.2906, longitude: 80.6337 },
    photos: [],
    status: 'PENDING_VERIFICATION',
    createdAt: minutesAgo(2),
    updatedAt: minutesAgo(2),
    ...overrides,
  };
}

export function decidedReport(
  status: 'VERIFIED' | 'REJECTED',
  overrides: Partial<HazardReportDto> = {},
): HazardReportDto {
  return report({
    status,
    decision: {
      decidedAt: minutesAgo(5),
      decidedBy: 'Officer Silva',
      officerNotes: 'Matches the gauge readings',
      ...(status === 'REJECTED' && {
        rejectionReason: 'INSUFFICIENT_INFORMATION' as const,
        rejectionDetails: 'Please add a photo',
      }),
    },
    ...overrides,
  });
}

export function page(
  items: HazardReportDto[],
  overrides: Partial<Paginated<HazardReportDto>> = {},
): Paginated<HazardReportDto> {
  return { items, total: items.length, page: 1, limit: 10, ...overrides };
}

export const stats: ReportStats = {
  pending: 12,
  verifiedToday: 24,
  rejected: 8,
  total: 136,
};

export function warning(
  overrides: Partial<HazardWarningDto> = {},
): HazardWarningDto {
  return {
    id: '6700aa77bcf86cd799439011',
    reference: 'HW-2026-0007',
    hazardType: 'FLOOD',
    level: 'HIGH',
    description:
      'Heavy rainfall expected. Immediate evacuation recommended for low-lying areas.',
    safetyInstructions: [
      'Move to higher ground immediately',
      'Avoid walking through floodwater',
    ],
    districts: ['COLOMBO'],
    validFrom: minutesAgo(10),
    validUntil: new Date(NOW.getTime() + 12 * 3600_000).toISOString(),
    status: 'DISSEMINATED',
    active: true,
    channels: [
      {
        channel: 'PUSH',
        state: 'SENT',
        recipients: 1245,
        delivered: 1245,
        attempts: 1,
        sentAt: minutesAgo(9),
      },
      {
        channel: 'SMS',
        state: 'SENT',
        recipients: 900,
        delivered: 900,
        attempts: 1,
        sentAt: minutesAgo(9),
      },
      {
        channel: 'AUDIBLE',
        state: 'SENT',
        recipients: 1,
        delivered: 1,
        attempts: 1,
        sentAt: minutesAgo(9),
      },
    ],
    createdBy: 'Officer Silva',
    issuedBy: 'Officer Silva',
    issuedAt: minutesAgo(10),
    createdAt: minutesAgo(10),
    updatedAt: minutesAgo(9),
    ...overrides,
  };
}

export function warningDetail(
  overrides: Partial<HazardWarningDetailDto> = {},
): HazardWarningDetailDto {
  return {
    ...warning(),
    logs: [
      {
        id: 'l1',
        channel: 'PUSH',
        kind: 'WARNING',
        outcome: 'SENT',
        message: 'Push notification delivered to 1245 citizens',
        recipients: 1245,
        createdAt: minutesAgo(9),
      },
    ],
    acknowledged: 312,
    ...overrides,
  };
}

export const warningStats: WarningStats = {
  active: 1,
  drafts: 2,
  issuedToday: 3,
};

export function preview(
  overrides: Partial<WarningPreview> = {},
): WarningPreview {
  return {
    recipients: { total: 4325, withPhone: 2100, byDistrict: { COLOMBO: 4325 } },
    duplicates: [],
    ...overrides,
  };
}
