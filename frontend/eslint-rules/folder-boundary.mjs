import path from 'node:path';

const APP_ROOT = 'the app root';
const SHARED_KERNEL = ['core', 'shared', 'pages'];
const ALLOWED_TARGETS = {
  shared: [],
  core: ['shared'],
  pages: ['core', 'shared'],
};

/** `APP_ROOT` for a loose file in `src/app/`, told from a kebab-case folder by its dot; null outside `src/app/`. */
function topFolder(file) {
  const segments = path.resolve(file).split(/[\\/]/);
  for (let i = segments.length - 2; i >= 0; i--) {
    if (segments[i] === 'src' && segments[i + 1] === 'app') {
      const below = segments.slice(i + 2);
      if (below.length === 0 || (below.length === 1 && below[0].includes('.'))) {
        return APP_ROOT;
      }
      return below[0];
    }
  }
  return null;
}

function mayImport(from, to) {
  if (SHARED_KERNEL.includes(from)) {
    return ALLOWED_TARGETS[from].includes(to);
  }
  // A feature may use core and shared; another feature, or pages, is off limits.
  return to === 'core' || to === 'shared' || to === APP_ROOT;
}

/** Covers `import`, `export … from` and `import()` with a relative literal specifier; package imports pass. */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Enforces the import direction between the top-level folders of src/app' },
    schema: [],
    messages: {
      forbidden: '{{from}} may not import from {{to}} (see frontend/AGENTS.md).',
    },
  },
  create(context) {
    const from = topFolder(context.filename);
    if (from === null || from === APP_ROOT) {
      return {};
    }

    function check(sourceNode) {
      const specifier = sourceNode?.type === 'Literal' ? sourceNode.value : null;
      if (typeof specifier !== 'string' || !specifier.startsWith('.')) {
        return;
      }
      const to = topFolder(path.resolve(path.dirname(context.filename), specifier));
      if (to === null || to === from || mayImport(from, to)) {
        return;
      }
      context.report({ node: sourceNode, messageId: 'forbidden', data: { from, to } });
    }

    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
    };
  },
};
