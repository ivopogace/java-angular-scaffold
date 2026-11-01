const DEFAULT_LOCALE = 'en-US';
const AMOUNT = /^(\d+)(?:[.,](\d{1,2}))?$/;

/** Formats an amount in minor units (cents) for display, scaled by the currency's fraction digits. */
export function formatMoney(
  minor: number,
  currency: string,
  locale: string = DEFAULT_LOCALE,
): string {
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(minor / 10 ** digits);
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
