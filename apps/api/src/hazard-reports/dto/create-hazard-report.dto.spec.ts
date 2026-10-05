import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CLIENT_REQUEST_ID } from '../testing/fixtures.js';
import { CreateHazardReportDto } from './create-hazard-report.dto.js';

const valid = {
  clientRequestId: CLIENT_REQUEST_ID,
  type: 'FLOOD',
  description: 'Water is rising near the bridge',
  // Multipart sends every field as a string.
  latitude: '7.2906',
  longitude: '80.6337',
};

async function check(overrides: Record<string, unknown> = {}) {
  const dto = plainToInstance(CreateHazardReportDto, {
    ...valid,
    ...overrides,
  });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, failed: errors.map((error) => error.property) };
}

describe('CreateHazardReportDto', () => {
  it('accepts a valid request and converts coordinates to numbers', async () => {
    const { dto, failed } = await check();

    expect(failed).toEqual([]);
    expect(dto.latitude).toBe(7.2906);
    expect(dto.longitude).toBe(80.6337);
  });

  it('trims the description', async () => {
    const { dto, failed } = await check({
      description: '   Water is rising near the bridge   ',
    });

    expect(failed).toEqual([]);
    expect(dto.description).toBe('Water is rising near the bridge');
  });

  it('counts a description of only spaces as too short', async () => {
    expect((await check({ description: ' '.repeat(30) })).failed).toEqual([
      'description',
    ]);
  });

  it.each([
    ['too short', 'Too short'],
    ['too long', 'x'.repeat(1001)],
    ['missing', undefined],
  ])('rejects a description that is %s', async (_name, description) => {
    expect((await check({ description })).failed).toEqual(['description']);
  });

  it('accepts descriptions exactly at both limits', async () => {
    expect((await check({ description: 'x'.repeat(10) })).failed).toEqual([]);
    expect((await check({ description: 'x'.repeat(1000) })).failed).toEqual([]);
  });

  it.each(['TORNADO', 'flood', '', undefined])(
    'rejects hazard type %s',
    async (type) => {
      expect((await check({ type })).failed).toEqual(['type']);
    },
  );

  it.each(['not-a-uuid', '', undefined])(
    'rejects clientRequestId %s',
    async (clientRequestId) => {
      expect((await check({ clientRequestId })).failed).toEqual([
        'clientRequestId',
      ]);
    },
  );

  it.each([
    ['latitude', '90.01'],
    ['latitude', '-90.01'],
    ['latitude', 'north'],
    ['latitude', 'Infinity'],
    ['latitude', undefined],
    ['longitude', '180.01'],
    ['longitude', '-180.01'],
    ['longitude', 'east'],
    ['longitude', undefined],
  ])('rejects %s %s', async (field, value) => {
    expect((await check({ [field]: value })).failed).toEqual([field]);
  });

  it('accepts coordinates on the boundary', async () => {
    expect((await check({ latitude: '-90', longitude: '180' })).failed).toEqual(
      [],
    );
  });

  it('treats blank optional text as not provided', async () => {
    const { dto, failed } = await check({
      reporterName: '   ',
      reporterContact: '',
    });

    expect(failed).toEqual([]);
    expect(dto.reporterName).toBeUndefined();
    expect(dto.reporterContact).toBeUndefined();
  });

  it('keeps trimmed optional text', async () => {
    const { dto } = await check({
      reporterName: ' Nimal Perera ',
      reporterContact: '+94 77 123 4567',
    });

    expect(dto.reporterName).toBe('Nimal Perera');
    expect(dto.reporterContact).toBe('+94 77 123 4567');
  });

  it('rejects over-long optional text', async () => {
    expect((await check({ reporterName: 'x'.repeat(101) })).failed).toEqual([
      'reporterName',
    ]);
    expect((await check({ reporterContact: 'x'.repeat(51) })).failed).toEqual([
      'reporterContact',
    ]);
  });

  it('rejects fields a client must never set', async () => {
    expect((await check({ status: 'VERIFIED' })).failed).toEqual(['status']);
  });
});
