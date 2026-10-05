import { DEFAULT_OFFICER_NAME, keysMatch, readOfficerName } from './caller.js';

describe('keysMatch', () => {
  it('matches identical keys', () => {
    expect(keysMatch('secret-key-1234567890', 'secret-key-1234567890')).toBe(
      true,
    );
  });

  it.each([
    ['a different key', 'secret-key-1234567891'],
    ['a prefix of the key', 'secret-key-123456789'],
    ['a longer key', 'secret-key-1234567890x'],
    ['an empty key', ''],
  ])('rejects %s', (_name, provided) => {
    expect(keysMatch(provided, 'secret-key-1234567890')).toBe(false);
  });
});

describe('readOfficerName', () => {
  it('uses a provided name, trimmed', () => {
    expect(readOfficerName('  Officer Silva ')).toBe('Officer Silva');
  });

  it.each([undefined, '', '   ', ['a', 'b']])(
    'falls back to the default for %j',
    (header) => {
      expect(readOfficerName(header)).toBe(DEFAULT_OFFICER_NAME);
    },
  );

  it('caps an over-long name', () => {
    expect(readOfficerName('x'.repeat(500))).toHaveLength(100);
  });
});
