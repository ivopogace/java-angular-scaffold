import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { formatMoney, injectFormatMoney, parseMoneyToMinor } from './money';

describe('formatMoney', () => {
  it('formats minor units as a currency amount', () => {
    expect(formatMoney(1250, 'EUR', 'en-US')).toBe('€12.50');
  });

  it('keeps two decimals for whole amounts', () => {
    expect(formatMoney(0, 'EUR', 'en-US')).toBe('€0.00');
  });

  it('honours the locale', () => {
    expect(formatMoney(123456, 'EUR', 'de-DE')).toBe('1.234,56 €');
  });

  it('scales by the currency fraction digits', () => {
    expect(formatMoney(500, 'JPY', 'en-US')).toBe('¥500');
  });

  it('falls back to a plain amount with the code when the currency is malformed', () => {
    expect(formatMoney(1250, 'EURO', 'en-US')).toBe('12.50 EURO');
    expect(formatMoney(1250, '', 'en-US')).toBe('12.50');
    expect(formatMoney(1250, 'EURO', 'de-DE')).toBe('12,50 EURO');
  });
});

describe('injectFormatMoney', () => {
  function formatterFor(locale: string): ReturnType<typeof injectFormatMoney> {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: locale }] });
    return TestBed.runInInjectionContext(() => injectFormatMoney());
  }

  it('formats in the active LOCALE_ID', () => {
    expect(formatterFor('de')(123456, 'EUR')).toBe('1.234,56\u00a0€');
  });

  it('follows the source locale when no locale is provided', () => {
    expect(TestBed.runInInjectionContext(() => injectFormatMoney())(1250, 'EUR')).toBe('€12.50');
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
