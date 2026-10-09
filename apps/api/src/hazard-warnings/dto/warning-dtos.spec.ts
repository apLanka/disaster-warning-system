import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterCitizenDto } from '../../citizens/dto/register-citizen.dto.js';
import { CLIENT_REQUEST_ID } from '../testing/fixtures.js';
import { CreateWarningDto } from './create-warning.dto.js';
import {
  CancelWarningDto,
  ListWarningsQueryDto,
} from './warning-action.dtos.js';

async function errorsFor<T extends object>(type: new () => T, body: object) {
  const errors = await validate(plainToInstance(type, body), {
    stopAtFirstError: true,
  });
  return Object.fromEntries(
    errors.map((e) => [e.property, Object.values(e.constraints ?? {})[0]]),
  );
}

const valid = {
  clientRequestId: CLIENT_REQUEST_ID,
  action: 'ISSUE',
  hazardType: 'FLOOD',
  level: 'HIGH',
  districts: ['COLOMBO'],
  description: 'Heavy rainfall expected in low-lying areas',
  safetyInstructions: ['  Move to higher ground ', ''],
  validUntil: '2026-10-07T20:00:00.000Z',
};

describe('CreateWarningDto', () => {
  it('accepts a complete warning and tidies the instruction rows', async () => {
    expect(await errorsFor(CreateWarningDto, valid)).toEqual({});
    expect(plainToInstance(CreateWarningDto, valid).safetyInstructions).toEqual(
      ['Move to higher ground'],
    );
  });

  it.each([
    ['districts', { districts: [] }, 'select at least one affected district'],
    ['districts', { districts: ['Colombo'] }, undefined],
    ['districts', { districts: ['COLOMBO', 'COLOMBO'] }, undefined],
    ['level', { level: 'SEVERE' }, undefined],
    ['action', { action: 'SEND' }, undefined],
    ['description', { description: 'short' }, undefined],
    ['validUntil', { validUntil: 'tomorrow' }, undefined],
    ['sourceReportId', { sourceReportId: '123' }, undefined],
    [
      'safetyInstructions',
      { safetyInstructions: Array(9).fill('Stay indoors') },
      undefined,
    ],
  ])('rejects a bad %s', async (field, change, message) => {
    const errors = await errorsFor(CreateWarningDto, { ...valid, ...change });
    expect(errors).toHaveProperty(field);
    if (message) expect(errors[field]).toBe(message);
  });

  it('lets a draft leave the description and period out', async () => {
    const {
      description: _d,
      validUntil: _v,
      safetyInstructions: _s,
      ...draft
    } = valid;
    expect(
      await errorsFor(CreateWarningDto, { ...draft, action: 'DRAFT' }),
    ).toEqual({});
  });
});

describe('CancelWarningDto', () => {
  it('needs a reason of 5 to 300 characters', async () => {
    expect(
      await errorsFor(CancelWarningDto, { reason: 'Water receded' }),
    ).toEqual({});
    expect(
      await errorsFor(CancelWarningDto, { reason: ' no ' }),
    ).toHaveProperty('reason');
    expect(await errorsFor(CancelWarningDto, {})).toHaveProperty('reason');
  });
});

describe('ListWarningsQueryDto', () => {
  it('defaults to the first page of active warnings', () => {
    const query = plainToInstance(ListWarningsQueryDto, {});
    expect(query).toMatchObject({ view: 'active', page: 1, limit: 20 });
  });

  it('rejects an unknown view and an oversized page', async () => {
    expect(
      await errorsFor(ListWarningsQueryDto, { view: 'all' }),
    ).toHaveProperty('view');
    expect(
      await errorsFor(ListWarningsQueryDto, { limit: '51' }),
    ).toHaveProperty('limit');
  });
});

describe('RegisterCitizenDto', () => {
  it('normalises a Sri Lankan mobile number', async () => {
    const dto = plainToInstance(RegisterCitizenDto, {
      district: 'KANDY',
      phone: '077 123 4567',
    });
    expect(dto.phone).toBe('+94771234567');
    expect(
      await errorsFor(RegisterCitizenDto, {
        district: 'KANDY',
        phone: '077 123 4567',
      }),
    ).toEqual({});
  });

  it('treats a blank phone as none and rejects a bad one', async () => {
    expect(
      plainToInstance(RegisterCitizenDto, { district: 'KANDY', phone: '  ' })
        .phone,
    ).toBeUndefined();
    expect(
      await errorsFor(RegisterCitizenDto, {
        district: 'KANDY',
        phone: '12345',
      }),
    ).toEqual({
      phone: 'phone must be a Sri Lankan mobile number, such as 077 123 4567',
    });
  });

  it('needs a known district', async () => {
    expect(
      await errorsFor(RegisterCitizenDto, { district: 'ATLANTIS' }),
    ).toHaveProperty('district');
  });
});
