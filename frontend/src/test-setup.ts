import { afterEach } from 'vitest';

import { freezeClock } from './testing/freeze-clock';

freezeClock();

afterEach(() => {
  freezeClock();
});
