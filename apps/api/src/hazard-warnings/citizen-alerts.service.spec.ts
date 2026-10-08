import { ConflictException, NotFoundException } from '@nestjs/common';

import { CitizenAlertsService } from './citizen-alerts.service.js';
import {
  delivery,
  DEVICE_ID,
  fakeDeliveries,
  fakeWarningRepository,
  hoursFromNow,
  issuedWarning,
  NOW,
  OTHER_WARNING_ID,
  WARNING_ID,
} from './testing/fixtures.js';

describe('CitizenAlertsService', () => {
  let deliveries: ReturnType<typeof fakeDeliveries>;
  let warnings: ReturnType<typeof fakeWarningRepository>;
  let service: CitizenAlertsService;

  beforeEach(() => {
    deliveries = fakeDeliveries();
    warnings = fakeWarningRepository();
    service = new CitizenAlertsService(deliveries, warnings);
  });

  it('lists delivered warnings, active first, then recent all-clears, hiding old ones', async () => {
    const cleared = issuedWarning({
      id: OTHER_WARNING_ID,
      issuedAt: hoursFromNow(1),
      status: 'CANCELLED',
      cancellation: {
        cancelledAt: NOW,
        cancelledBy: 'Officer Silva',
        reason: 'Receded',
      },
    });
    const old = issuedWarning({
      id: '6700aa77bcf86cd799439033',
      validUntil: hoursFromNow(-24 * 10),
    });
    deliveries.listForDevice.mockResolvedValue([
      delivery({ warningId: OTHER_WARNING_ID }),
      delivery({ warningId: WARNING_ID }),
      delivery({ warningId: old.id }),
    ]);
    warnings.findByIds.mockResolvedValue([cleared, issuedWarning(), old]);

    const alerts = await service.listMine(DEVICE_ID, NOW);

    expect(alerts.map((a) => [a.id, a.state])).toEqual([
      [WARNING_ID, 'ACTIVE'],
      [OTHER_WARNING_ID, 'ALL_CLEAR'],
    ]);
    expect(alerts[1]?.cancelReason).toBe('Receded');
    expect(deliveries.listForDevice).toHaveBeenCalledWith(DEVICE_ID, 50);
  });

  it('returns nothing for a device that never received a warning', async () => {
    await expect(service.listMine(DEVICE_ID, NOW)).resolves.toEqual([]);
    expect(warnings.findByIds).not.toHaveBeenCalled();
  });

  it('acknowledges an active warning delivered to the device', async () => {
    warnings.findById.mockResolvedValue(issuedWarning());
    deliveries.acknowledge.mockResolvedValue(delivery({ acknowledgedAt: NOW }));

    const alert = await service.acknowledge(WARNING_ID, DEVICE_ID, NOW);

    expect(alert.acknowledgedAt).toBe(NOW.toISOString());
    expect(deliveries.acknowledge).toHaveBeenCalledWith(
      WARNING_ID,
      DEVICE_ID,
      NOW,
    );
  });

  it('404s a warning that was never delivered to this device', async () => {
    warnings.findById.mockResolvedValue(issuedWarning());
    deliveries.acknowledge.mockResolvedValue(null);
    await expect(
      service.acknowledge(WARNING_ID, DEVICE_ID, NOW),
    ).rejects.toThrow(new NotFoundException('Alert not found'));
  });

  it('404s an unknown or draft warning', async () => {
    warnings.findById.mockResolvedValue(null);
    await expect(
      service.acknowledge(WARNING_ID, DEVICE_ID, NOW),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses to acknowledge a warning that is no longer active', async () => {
    warnings.findById.mockResolvedValue(
      issuedWarning({ validUntil: hoursFromNow(-1) }),
    );
    await expect(
      service.acknowledge(WARNING_ID, DEVICE_ID, NOW),
    ).rejects.toThrow(
      new ConflictException('This warning is no longer active'),
    );
    expect(deliveries.acknowledge).not.toHaveBeenCalled();
  });
});
