/**
 * Shared by the MCP launchers: how to run `npx`, and how to tie a launcher to the server it starts.
 *
 * Spawning the name `npx` needs a shell on Windows (it is a `.cmd` shim), and a shell spawn with an
 * args array is deprecated (Node DEP0190: the arguments are concatenated, not escaped). npm ships
 * beside the running node, so its `npx-cli.js` is started with that node directly: no shell on any
 * platform, no shim, and the npm that belongs to this node. A node without npm beside it falls back
 * to the name `npx`; on Windows that needs cmd.exe, so the command is one quoted string and `args`
 * stays empty.
 */
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

/**
 * How to run `npx <npxArgs>`. Pure: `execPath`, `exists` and `platform` are injected.
 *
 * @returns {{ command: string, args: string[], shell: boolean }} the `spawn` arguments.
 */
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

/**
 * Starts the server with inherited stdio and ties this launcher to it: the MCP client stops the
 * launcher by pid, so signals are forwarded and the launcher exits with the server's code.
 */
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
