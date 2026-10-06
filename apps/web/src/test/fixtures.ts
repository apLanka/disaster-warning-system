import type { HazardReportDto, Paginated, ReportStats } from '@repo/types';

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
