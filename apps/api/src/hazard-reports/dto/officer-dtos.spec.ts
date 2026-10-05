import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ListReportsQueryDto } from './list-reports-query.dto.js';
import { RejectReportDto } from './reject-report.dto.js';
import { VerifyReportDto } from './verify-report.dto.js';

async function check<T extends object>(
  type: new () => T,
  plain: Record<string, unknown>,
) {
  const dto = plainToInstance(type, plain);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return {
    dto,
    failed: errors.map((error) => error.property),
    messages: errors.flatMap((error) => Object.values(error.constraints ?? {})),
  };
}

describe('VerifyReportDto', () => {
  it('accepts an empty body', async () => {
    expect((await check(VerifyReportDto, {})).failed).toEqual([]);
  });

  it('trims notes and treats blank notes as absent', async () => {
    expect((await check(VerifyReportDto, { notes: ' ok ' })).dto.notes).toBe(
      'ok',
    );
    expect(
      (await check(VerifyReportDto, { notes: '  ' })).dto.notes,
    ).toBeUndefined();
  });

  it('rejects notes over 500 characters', async () => {
    expect(
      (await check(VerifyReportDto, { notes: 'x'.repeat(501) })).failed,
    ).toEqual(['notes']);
  });

  it('rejects unknown fields', async () => {
    expect(
      (await check(VerifyReportDto, { status: 'REJECTED' })).failed,
    ).toEqual(['status']);
  });
});

describe('RejectReportDto', () => {
  it.each([
    'DUPLICATE',
    'INSUFFICIENT_INFORMATION',
    'UNVERIFIABLE',
    'OUT_OF_AREA',
  ])('accepts %s without details', async (reason) => {
    expect((await check(RejectReportDto, { reason })).failed).toEqual([]);
  });

  it('requires a reason', async () => {
    expect((await check(RejectReportDto, {})).failed).toEqual(['reason']);
  });

  it('rejects an unknown reason', async () => {
    expect((await check(RejectReportDto, { reason: 'BORED' })).failed).toEqual([
      'reason',
    ]);
  });

  it('requires details when the reason is OTHER', async () => {
    const result = await check(RejectReportDto, { reason: 'OTHER' });

    expect(result.failed).toEqual(['details']);
    expect(result.messages).toContain(
      'details is required when reason is OTHER',
    );
  });

  it('treats blank details as missing when the reason is OTHER', async () => {
    expect(
      (await check(RejectReportDto, { reason: 'OTHER', details: '   ' }))
        .failed,
    ).toEqual(['details']);
  });

  it('accepts OTHER with details, trimmed', async () => {
    const { dto, failed } = await check(RejectReportDto, {
      reason: 'OTHER',
      details: '  Photo is of a different place ',
    });

    expect(failed).toEqual([]);
    expect(dto.details).toBe('Photo is of a different place');
  });

  it('ignores blank details for the other reasons', async () => {
    const { dto, failed } = await check(RejectReportDto, {
      reason: 'DUPLICATE',
      details: '  ',
    });

    expect(failed).toEqual([]);
    expect(dto.details).toBeUndefined();
  });

  it('rejects details over 500 characters', async () => {
    expect(
      (
        await check(RejectReportDto, {
          reason: 'DUPLICATE',
          details: 'x'.repeat(501),
        })
      ).failed,
    ).toEqual(['details']);
  });

  it('accepts optional internal notes', async () => {
    const { dto, failed } = await check(RejectReportDto, {
      reason: 'DUPLICATE',
      notes: ' same as HR-2026-0003 ',
    });

    expect(failed).toEqual([]);
    expect(dto.notes).toBe('same as HR-2026-0003');
  });
});

describe('ListReportsQueryDto', () => {
  it('applies defaults when nothing is given', async () => {
    const { dto, failed } = await check(ListReportsQueryDto, {});

    expect(failed).toEqual([]);
    expect(dto).toMatchObject({ sort: 'newest', page: 1, limit: 20 });
    expect(dto.status).toBeUndefined();
    expect(dto.type).toBeUndefined();
  });

  it('converts query strings to numbers', async () => {
    const { dto, failed } = await check(ListReportsQueryDto, {
      status: 'PENDING_VERIFICATION',
      type: 'LANDSLIDE',
      sort: 'oldest',
      page: '3',
      limit: '5',
    });

    expect(failed).toEqual([]);
    expect(dto).toMatchObject({
      status: 'PENDING_VERIFICATION',
      type: 'LANDSLIDE',
      sort: 'oldest',
      page: 3,
      limit: 5,
    });
  });

  it.each([
    ['status', 'PENDING_SYNC'],
    ['status', 'DONE'],
    ['type', 'TORNADO'],
    ['sort', 'random'],
    ['page', '0'],
    ['page', '1.5'],
    ['page', 'abc'],
    ['limit', '0'],
    ['limit', '51'],
  ])('rejects %s=%s', async (field, value) => {
    expect(
      (await check(ListReportsQueryDto, { [field]: value })).failed,
    ).toEqual([field]);
  });

  it('accepts the largest page size', async () => {
    expect((await check(ListReportsQueryDto, { limit: '50' })).failed).toEqual(
      [],
    );
  });
});
