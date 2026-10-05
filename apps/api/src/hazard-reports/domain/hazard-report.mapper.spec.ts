import type { HazardReportEntity } from './hazard-report.entity.js';
import { toHazardReportDto } from './hazard-report.mapper.js';

const base: HazardReportEntity = {
  id: '665f1f77bcf86cd799439011',
  reference: 'HR-2026-0001',
  reporterId: 'reporter-1',
  clientRequestId: 'client-1',
  type: 'FLOOD',
  description: 'Water is rising near the bridge',
  location: { latitude: 7.2906, longitude: 80.6337 },
  photos: [],
  status: 'PENDING_VERIFICATION',
  createdAt: new Date('2026-10-05T06:35:00.000Z'),
  updatedAt: new Date('2026-10-05T06:35:00.000Z'),
};

describe('toHazardReportDto', () => {
  it('serialises dates as ISO strings', () => {
    const dto = toHazardReportDto(base);

    expect(dto.createdAt).toBe('2026-10-05T06:35:00.000Z');
    expect(dto.updatedAt).toBe('2026-10-05T06:35:00.000Z');
  });

  it('leaves out the decision while the report is pending', () => {
    expect(toHazardReportDto(base).decision).toBeUndefined();
  });

  it('never exposes the clientRequestId', () => {
    expect(toHazardReportDto(base)).not.toHaveProperty('clientRequestId');
  });

  it('maps a rejection with its reason and details', () => {
    const dto = toHazardReportDto({
      ...base,
      status: 'REJECTED',
      decision: {
        decidedAt: new Date('2026-10-05T07:00:00.000Z'),
        decidedBy: 'officer-1',
        rejectionReason: 'OTHER',
        rejectionDetails: 'Photo shows a different place',
      },
    });

    expect(dto.status).toBe('REJECTED');
    expect(dto.decision).toEqual({
      decidedAt: '2026-10-05T07:00:00.000Z',
      decidedBy: 'officer-1',
      officerNotes: undefined,
      rejectionReason: 'OTHER',
      rejectionDetails: 'Photo shows a different place',
    });
  });

  it('carries photos and the reporter contact through', () => {
    const photo = {
      publicId: 'hazard-reports/a',
      secureUrl: 'https://res.cloudinary.com/demo/a.jpg',
      width: 800,
      height: 600,
      bytes: 1234,
    };

    const dto = toHazardReportDto({
      ...base,
      photos: [photo],
      reporterName: 'Nimal Perera',
      reporterContact: '+94 77 123 4567',
    });

    expect(dto.photos).toEqual([photo]);
    expect(dto.reporterName).toBe('Nimal Perera');
    expect(dto.reporterContact).toBe('+94 77 123 4567');
  });
});
