import { BadRequestException } from '@nestjs/common';

import { parseReporterId } from './reporter-id.decorator.js';

const UUID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('parseReporterId', () => {
  it('accepts a UUID', () => {
    expect(parseReporterId(UUID)).toBe(UUID);
  });

  it('normalises case so one device is always one reporter', () => {
    expect(parseReporterId(UUID.toUpperCase())).toBe(UUID);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not a uuid', 'device-1'],
    ['a repeated header', [UUID, UUID]],
    ['padded', ` ${UUID}`],
  ])('rejects a header that is %s', (_name, header) => {
    expect(() => parseReporterId(header)).toThrow(BadRequestException);
  });
});
