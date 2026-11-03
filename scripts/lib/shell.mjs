/** For cmd.exe: backslashes before a quote, or before the closing quote, are doubled. */
export function quoteForCmd(arg) {
  if (/^[\w@%+=:,./\\-]+$/.test(arg)) return arg;
  const escaped = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1");
  return `"${escaped}"`;
}
