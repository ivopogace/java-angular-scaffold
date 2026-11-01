import { expectNoAxeViolations } from './axe';

describe('expectNoAxeViolations', () => {
  it('rejects an element containing a serious violation', async () => {
    const bad = document.createElement('div');
    bad.innerHTML = '<img src="logo.png">';
    await expect(expectNoAxeViolations(bad)).rejects.toThrow();
  });

  it('rejects an element whose only violation is moderate (skipped heading level)', async () => {
    const moderate = document.createElement('div');
    moderate.innerHTML = '<h1>Title</h1><h3>Skipped a level</h3>';
    await expect(expectNoAxeViolations(moderate)).rejects.toThrow();
  });

  it('passes an element without violations', async () => {
    const good = document.createElement('div');
    good.innerHTML = '<img src="logo.png" alt="Company logo">';
    await expect(expectNoAxeViolations(good)).resolves.toBeUndefined();
  });
});
