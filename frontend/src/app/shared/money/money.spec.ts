import { formatMoney, parseMoneyToMinor } from './money';

describe('formatMoney', () => {
  it('formats minor units as a currency amount', () => {
    expect(formatMoney(1250, 'EUR')).toBe('€12.50');
  });

  it('keeps two decimals for whole amounts', () => {
    expect(formatMoney(0, 'EUR')).toBe('€0.00');
  });

  it('honours the locale', () => {
    expect(formatMoney(123456, 'EUR', 'de-DE')).toBe('1.234,56 €');
  });

  it('scales by the currency fraction digits', () => {
    expect(formatMoney(500, 'JPY', 'en-US')).toBe('¥500');
  });

  it('falls back to a plain amount with the code when the currency is malformed', () => {
    expect(formatMoney(1250, 'EURO')).toBe('12.50 EURO');
    expect(formatMoney(1250, '')).toBe('12.50');
  });
});

describe('parseMoneyToMinor', () => {
  it.each([
    ['12.50', 1250],
    ['12,5', 1250],
    ['12', 1200],
    ['0', 0],
    ['0.05', 5],
    ['  7.00 ', 700],
  ])('reads "%s" as %i minor units', (text, minor) => {
    expect(parseMoneyToMinor(text)).toBe(minor);
  });

  it.each(['12.345', 'abc', '', '   ', '-1', '1.2.3', '12.', '.5', '1e3'])(
    'rejects "%s"',
    (text) => {
      expect(parseMoneyToMinor(text)).toBeNull();
    },
  );
});
