import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Runs axe-core over a rendered element and fails on any violation, whatever its impact.
 *
 * `color-contrast` is disabled because jsdom has no layout, so axe can never decide it; the
 * Playwright suite checks contrast in a real browser. `region` is disabled because a component
 * rendered alone is a fragment, not a page.
 */
const AUDIT_CONFIG: axe.RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
};

export async function expectNoAxeViolations(element: Element): Promise<void> {
  // axe resolves relationships such as aria-labelledby only for nodes attached to the document.
  const attached = element.isConnected;
  if (!attached) {
    document.body.appendChild(element);
  }
  try {
    const results = await axe.run(element, AUDIT_CONFIG);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  } finally {
    if (!attached) {
      element.remove();
    }
  }
}

function formatViolations(violations: readonly axe.Result[]): string {
  return violations
    .map((v) => {
      const targets = v.nodes.map((n) => n.target.join(' ')).join(', ');
      return `[${v.impact}] ${v.id}: ${v.help} (${targets})\n  ${v.helpUrl}`;
    })
    .join('\n');
}
