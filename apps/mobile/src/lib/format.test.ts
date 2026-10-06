import { formatCoordinates } from './format';

describe('formatCoordinates', () => {
  it('uses four decimals and hemisphere letters', () => {
    expect(formatCoordinates({ latitude: 7.2906, longitude: 80.6337 })).toBe(
      '7.2906° N, 80.6337° E',
    );
  });

  it('uses S and W for negative values, without a minus sign', () => {
    expect(formatCoordinates({ latitude: -33.8688, longitude: -70.5 })).toBe(
      '33.8688° S, 70.5000° W',
    );
  });

  it('rounds to four decimals', () => {
    expect(
      formatCoordinates({ latitude: 7.123456, longitude: 80.987654 }),
    ).toBe('7.1235° N, 80.9877° E');
  });

  it('treats zero as north and east', () => {
    expect(formatCoordinates({ latitude: 0, longitude: 0 })).toBe(
      '0.0000° N, 0.0000° E',
    );
  });
});
