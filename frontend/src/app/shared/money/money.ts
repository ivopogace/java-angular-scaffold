import { inject, LOCALE_ID } from '@angular/core';

const AMOUNT = /^(\d+)(?:[.,](\d{1,2}))?$/;

const FALLBACK_DIGITS = 2;

export type MoneyFormatter = (minor: number, currency: string) => string;

/** A currency code `Intl` rejects is shown after a two-decimal amount, so a bad row never breaks the page. */
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

/** Call in an injection context (a field initializer). */
export function injectFormatMoney(): MoneyFormatter {
  const locale = inject(LOCALE_ID);
  return (minor, currency) => formatMoney(minor, currency, locale);
}

/** `"12.50"` or `"12,5"` as minor units of a two-decimal currency; `null` for anything else. */
export function parseMoneyToMinor(text: string): number | null {
  const match = AMOUNT.exec(text.trim());
  if (!match) {
    return null;
  }
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}
