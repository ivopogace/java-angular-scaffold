import axe from 'axe-core';
import { expect } from 'vitest';

// jsdom has no layout for `color-contrast` (Playwright checks it); a lone component is no page for `region`.
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
