import { inject, LOCALE_ID } from '@angular/core';

const AMOUNT = /^(\d+)(?:[.,](\d{1,2}))?$/;

const FALLBACK_DIGITS = 2;

/** `formatMoney` bound to a locale. */
export type MoneyFormatter = (minor: number, currency: string) => string;

/**
 * Formats an amount in minor units (cents) for display in `locale`, scaled by the currency's
 * fraction digits. A currency code `Intl` rejects (not three letters) is shown as a two-decimal
 * amount followed by the code as sent, so a bad row never breaks the page. Components use
 * `injectFormatMoney()`, which passes the active `LOCALE_ID`.
 */
export function formatMoney(minor: number, currency: string, locale: string): string {
  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat(locale, { style: 'currency', currency });
  } catch {
    const amount = new Intl.NumberFormat(locale, {
      minimumFractionDigits: FALLBACK_DIGITS,
      maximumFractionDigits: FALLBACK_DIGITS,
    }).format(minor / 10 ** FALLBACK_DIGITS);
    return `${amount} ${currency}`.trim();
  }
  const digits = format.resolvedOptions().maximumFractionDigits ?? FALLBACK_DIGITS;
  return format.format(minor / 10 ** digits);
}

/** `formatMoney` in the active `LOCALE_ID`; call it in an injection context (a field initializer). */
export function injectFormatMoney(): MoneyFormatter {
  const locale = inject(LOCALE_ID);
  return (minor, currency) => formatMoney(minor, currency, locale);
}

/**
 * Reads user input such as `"12.50"` or `"12,5"` as minor units of a two-decimal currency.
 * Returns `null` for anything that is not a non-negative amount with at most two decimals.
 */
export function parseMoneyToMinor(text: string): number | null {
  const match = AMOUNT.exec(text.trim());
  if (!match) {
    return null;
  }
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}
