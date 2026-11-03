import { vi } from 'vitest';

/** Midday UTC keeps the civil date stable in every time zone. */
export const FROZEN_INSTANT = '2030-01-14T12:00:00Z';

/** After `vi.useFakeTimers()` restore with this, never `vi.useRealTimers()`, which brings back the real date. */
export function freezeClock(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_INSTANT));
}
