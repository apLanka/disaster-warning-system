import { NotFoundException } from '@nestjs/common';

import {
  citizen,
  DEVICE_ID,
  fakeDirectory,
} from '../hazard-warnings/testing/fixtures.js';
import { CitizensService } from './citizens.service.js';

describe('CitizensService', () => {
  it('registers the device in a district with an optional phone', async () => {
    const directory = fakeDirectory();
    directory.register.mockResolvedValue(citizen());

    await new CitizensService(directory).register(DEVICE_ID, {
      district: 'COLOMBO',
      phone: '+94771234567',
    });

    expect(directory.register).toHaveBeenCalledWith(
      DEVICE_ID,
      'COLOMBO',
      '+94771234567',
    );
  });

  it('returns the profile, or 404 when the district was never set', async () => {
    const directory = fakeDirectory();
    directory.findByDeviceId
      .mockResolvedValueOnce(citizen())
      .mockResolvedValueOnce(null);
    const service = new CitizensService(directory);

    await expect(service.profile(DEVICE_ID)).resolves.toEqual(citizen());
    await expect(service.profile(DEVICE_ID)).rejects.toThrow(
      new NotFoundException('Set your district to receive warnings'),
    );
  });
});
