import { vi } from 'vitest';

import { FROZEN_INSTANT, freezeClock } from './freeze-clock';

describe('frozen clock', () => {
  it('is installed by the test setup', () => {
    expect(new Date().toISOString()).toBe('2030-01-14T12:00:00.000Z');
  });

  it('is restored by freezeClock() after full fake timers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2000-01-01T00:00:00Z'));
    freezeClock();
    expect(Date.now()).toBe(Date.parse(FROZEN_INSTANT));
  });
});
