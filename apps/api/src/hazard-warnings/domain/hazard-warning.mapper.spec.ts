import {
  delivery,
  issuedWarning,
  NOW,
  warningEntity,
} from '../testing/fixtures.js';
import {
  toCitizenAlertDto,
  toHazardWarningDetailDto,
  toHazardWarningDto,
} from './hazard-warning.mapper.js';

describe('toHazardWarningDto', () => {
  it('serialises dates and marks an issued warning active', () => {
    const dto = toHazardWarningDto(issuedWarning(), NOW);

    expect(dto).toMatchObject({
      id: issuedWarning().id,
      status: 'DISSEMINATED',
      active: true,
      issuedAt: NOW.toISOString(),
      validUntil: '2026-10-07T20:00:00.000Z',
    });
    expect(dto.channels[0]).toEqual({
      channel: 'PUSH',
      state: 'SENT',
      recipients: 10,
      delivered: 10,
      attempts: 1,
      lastError: undefined,
      sentAt: NOW.toISOString(),
    });
  });

  it('leaves out what a draft does not have', () => {
    const dto = toHazardWarningDto(
      warningEntity({ validUntil: undefined }),
      NOW,
    );
    expect(dto.active).toBe(false);
    expect(dto.issuedAt).toBeUndefined();
    expect(dto.validUntil).toBeUndefined();
    expect(dto.cancellation).toBeUndefined();
  });

  it('includes the cancellation', () => {
    const dto = toHazardWarningDto(
      issuedWarning({
        status: 'CANCELLED',
        cancellation: {
          cancelledAt: NOW,
          cancelledBy: 'Officer Silva',
          reason: 'Receded',
        },
      }),
      NOW,
    );
    expect(dto.cancellation).toEqual({
      cancelledAt: NOW.toISOString(),
      cancelledBy: 'Officer Silva',
      reason: 'Receded',
    });
  });
});

describe('toHazardWarningDetailDto', () => {
  it('adds the logs and the acknowledged count', () => {
    const dto = toHazardWarningDetailDto(
      issuedWarning(),
      [
        {
          id: 'l1',
          warningId: issuedWarning().id,
          channel: 'SMS',
          kind: 'WARNING',
          outcome: 'FAILED',
          message: 'SMS gateway is unavailable',
          recipients: 3,
          createdAt: NOW,
        },
      ],
      4,
      NOW,
    );
    expect(dto.acknowledged).toBe(4);
    expect(dto.logs).toEqual([
      expect.objectContaining({
        id: 'l1',
        outcome: 'FAILED',
        createdAt: NOW.toISOString(),
      }),
    ]);
  });
});

describe('toCitizenAlertDto', () => {
  it('shows the citizen only public fields, with the acknowledgement', () => {
    const dto = toCitizenAlertDto(
      issuedWarning(),
      delivery({ acknowledgedAt: NOW }),
      'ACTIVE',
    );

    expect(dto).toEqual({
      id: issuedWarning().id,
      reference: 'HW-2026-0001',
      hazardType: 'FLOOD',
      level: 'HIGH',
      districts: ['COLOMBO', 'GAMPAHA'],
      description: 'Heavy rainfall expected. Evacuate low-lying areas.',
      safetyInstructions: ['Move to higher ground immediately'],
      issuedAt: NOW.toISOString(),
      validUntil: '2026-10-07T20:00:00.000Z',
      state: 'ACTIVE',
      cancelReason: undefined,
      acknowledgedAt: NOW.toISOString(),
    });
    expect(dto).not.toHaveProperty('issuedBy');
  });
});
