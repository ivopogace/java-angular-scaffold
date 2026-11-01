import { vi } from 'vitest';

/** The instant the unit-test clock is frozen at; midday UTC keeps the civil date stable everywhere. */
export const FROZEN_INSTANT = '2030-01-14T12:00:00Z';

/**
 * Freezes `Date` at {@link FROZEN_INSTANT}. Only `Date` is faked; timers stay real.
 *
 * A spec that opts into full fake timers with `vi.useFakeTimers()` restores with this function,
 * never `vi.useRealTimers()`, which would hand the machine's real calendar to later tests.
 */
export function freezeClock(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_INSTANT));
}
