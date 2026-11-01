/**
 * Quotes one argument for a Windows (cmd.exe) command line. A plain argument passes through; any
 * other is double-quoted, with the backslashes before a quote (or before the closing quote) doubled.
 */
export function quoteForCmd(arg) {
  if (/^[\w@%+=:,./\\-]+$/.test(arg)) return arg;
  const escaped = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1");
  return `"${escaped}"`;
}
