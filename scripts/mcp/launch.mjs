// Without npm beside node, Windows spawns `npx` via cmd.exe as one quoted string: shell args are unescaped (DEP0190).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { quoteForCmd } from "../lib/shell.mjs";

/** npm's `npx-cli.js` relative to the node binary: beside it on Windows, under `lib/` elsewhere. */
export function npxCliCandidates(execPath) {
  const bin = dirname(execPath);
  const tail = ["npm", "bin", "npx-cli.js"];
  return [
    join(bin, "node_modules", ...tail),
    join(bin, "..", "lib", "node_modules", ...tail),
  ];
}

export function resolveNpx(
  npxArgs,
  {
    execPath = process.execPath,
    exists = existsSync,
    platform = process.platform,
  } = {},
) {
  const cli = npxCliCandidates(execPath).find((path) => exists(path));
  if (cli) return { command: execPath, args: [cli, ...npxArgs], shell: false };
  if (platform !== "win32") {
    return { command: "npx", args: npxArgs, shell: false };
  }
  return {
    command: ["npx", ...npxArgs].map(quoteForCmd).join(" "),
    args: [],
    shell: true,
  };
}

/** The MCP client stops the launcher by pid, so signals are forwarded and the server's exit code passed on. */
export function launch({ command, args, shell }, label) {
  const child = spawn(command, args, { stdio: "inherit", shell });
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (error) => {
    console.error(`${label} MCP: failed to start ${command}: ${error.message}`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
}
