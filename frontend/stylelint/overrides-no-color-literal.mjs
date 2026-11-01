import stylelint from 'stylelint';

/**
 * Rejects colour literals in the arguments of a Material `*-overrides` mixin (invariant #8).
 *
 * `color-no-hex`, `color-named` and `function-disallowed-list` check declarations only. This rule
 * looks at every `@include` whose mixin name ends in `-overrides` (with or without a module prefix)
 * and flags a hex colour, one of the banned colour functions or a CSS named colour anywhere in the
 * argument text; `var(--mat-sys-*)`, `transparent`, `currentcolor`, Sass variables, module
 * functions such as `color.adjust()` and quoted strings pass.
 */
const ruleName = 'local/overrides-no-color-literal';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (literal, mixin) =>
    `Unexpected colour literal "${literal}" in ${mixin}(); pass a --mat-sys-* token (invariant #8)`,
});

/** `mat.button-overrides(` or `button-overrides(`: group 1 is the mixin name as written. */
const OVERRIDES_MIXIN = /^\s*((?:[\w-]+\.)?[\w-]+-overrides)\s*\(/;

/** Quoted strings and comments: never a colour value, and a place a hex digit or a word may hide. */
const INERT_TEXT = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

const HEX_COLOR = /#[0-9a-f]{3,8}(?![\w-])/gi;

/** A Sass/CSS word: identifier characters plus `$` (variables) and `.` (module members). */
const WORD = /[\w$.-]+/g;

/** The same functions `.stylelintrc.json` bans in declarations; `stylelint-config.test.mjs` keeps the two in step. */
export const COLOR_FUNCTIONS = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
]);

/** CSS named colours (Color Level 4). `transparent` and `currentcolor` are keywords, not colours. */
const NAMED_COLORS = new Set([
  'aliceblue',
  'antiquewhite',
  'aqua',
  'aquamarine',
  'azure',
  'beige',
  'bisque',
  'black',
  'blanchedalmond',
  'blue',
  'blueviolet',
  'brown',
  'burlywood',
  'cadetblue',
  'chartreuse',
  'chocolate',
  'coral',
  'cornflowerblue',
  'cornsilk',
  'crimson',
  'cyan',
  'darkblue',
  'darkcyan',
  'darkgoldenrod',
  'darkgray',
  'darkgreen',
  'darkgrey',
  'darkkhaki',
  'darkmagenta',
  'darkolivegreen',
  'darkorange',
  'darkorchid',
  'darkred',
  'darksalmon',
  'darkseagreen',
  'darkslateblue',
  'darkslategray',
  'darkslategrey',
  'darkturquoise',
  'darkviolet',
  'deeppink',
  'deepskyblue',
  'dimgray',
  'dimgrey',
  'dodgerblue',
  'firebrick',
  'floralwhite',
  'forestgreen',
  'fuchsia',
  'gainsboro',
  'ghostwhite',
  'gold',
  'goldenrod',
  'gray',
  'green',
  'greenyellow',
  'grey',
  'honeydew',
  'hotpink',
  'indianred',
  'indigo',
  'ivory',
  'khaki',
  'lavender',
  'lavenderblush',
  'lawngreen',
  'lemonchiffon',
  'lightblue',
  'lightcoral',
  'lightcyan',
  'lightgoldenrodyellow',
  'lightgray',
  'lightgreen',
  'lightgrey',
  'lightpink',
  'lightsalmon',
  'lightseagreen',
  'lightskyblue',
  'lightslategray',
  'lightslategrey',
  'lightsteelblue',
  'lightyellow',
  'lime',
  'limegreen',
  'linen',
  'magenta',
  'maroon',
  'mediumaquamarine',
  'mediumblue',
  'mediumorchid',
  'mediumpurple',
  'mediumseagreen',
  'mediumslateblue',
  'mediumspringgreen',
  'mediumturquoise',
  'mediumvioletred',
  'midnightblue',
  'mintcream',
  'mistyrose',
  'moccasin',
  'navajowhite',
  'navy',
  'oldlace',
  'olive',
  'olivedrab',
  'orange',
  'orangered',
  'orchid',
  'palegoldenrod',
  'palegreen',
  'paleturquoise',
  'palevioletred',
  'papayawhip',
  'peachpuff',
  'peru',
  'pink',
  'plum',
  'powderblue',
  'purple',
  'rebeccapurple',
  'red',
  'rosybrown',
  'royalblue',
  'saddlebrown',
  'salmon',
  'sandybrown',
  'seagreen',
  'seashell',
  'sienna',
  'silver',
  'skyblue',
  'slateblue',
  'slategray',
  'slategrey',
  'snow',
  'springgreen',
  'steelblue',
  'tan',
  'teal',
  'thistle',
  'tomato',
  'turquoise',
  'violet',
  'wheat',
  'white',
  'whitesmoke',
  'yellow',
  'yellowgreen',
]);

/** Replaces every inert span with spaces of the same length, so offsets into `text` stay valid. */
const blankInert = (text) => text.replace(INERT_TEXT, (span) => ' '.repeat(span.length));

/**
 * The colour literals in a mixin's argument text, as `{ literal, index, length }` in source
 * order; `index` is the offset into `text`.
 */
export function colorLiterals(text) {
  const found = [];
  let scan = blankInert(text);
  for (const match of scan.matchAll(HEX_COLOR)) {
    found.push({ literal: match[0], index: match.index, length: match[0].length });
  }
  scan = scan.replace(HEX_COLOR, (span) => ' '.repeat(span.length));
  for (const match of scan.matchAll(WORD)) {
    const word = match[0];
    const rest = scan.slice(match.index + word.length);
    if (/^\s*\(/.test(rest)) {
      if (COLOR_FUNCTIONS.has(word.toLowerCase())) {
        found.push({ literal: `${word}()`, index: match.index, length: word.length });
      }
    } else if (!/^\s*:/.test(rest) && NAMED_COLORS.has(word.toLowerCase())) {
      // A word before `:` is a map key or a keyword argument name, never a colour value.
      found.push({ literal: word, index: match.index, length: word.length });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

/** Offset of `atRule.params` from the start of the at-rule (`@include` plus the space after it). */
const paramsIndex = (atRule) => 1 + atRule.name.length + (atRule.raws.afterName?.length ?? 0);

const ruleFunction = (primary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [true],
  });
  if (!valid) return;

  root.walkAtRules('include', (atRule) => {
    const mixin = OVERRIDES_MIXIN.exec(atRule.params);
    if (!mixin) return;
    const argsOffset = paramsIndex(atRule) + mixin[0].length;
    for (const { literal, index, length } of colorLiterals(atRule.params.slice(mixin[0].length))) {
      stylelint.utils.report({
        ruleName,
        result,
        message: messages.rejected(literal, mixin[1]),
        node: atRule,
        index: argsOffset + index,
        endIndex: argsOffset + index + length,
      });
    }
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;

export default stylelint.createPlugin(ruleName, ruleFunction);
