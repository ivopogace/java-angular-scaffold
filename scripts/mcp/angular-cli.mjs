// Prefers the installed CLI: npx resolves against the registry on every start and can miss the connect timeout.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, resolveNpx } from "./launch.mjs";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function resolveLauncher(
  root,
  {
    exists = existsSync,
    cliVersion = () => pinnedCliVersion(root),
    execPath = process.execPath,
    platform = process.platform,
  } = {},
) {
  const modules = join(root, "frontend", "node_modules");
  const cli = join(modules, "@angular", "cli", "bin", "ng.js");
  if (exists(cli) && exists(join(modules, ".package-lock.json"))) {
    return { command: execPath, args: [cli, "mcp"], shell: false, local: true };
  }
  const npx = resolveNpx(["-y", `@angular/cli@${cliVersion()}`, "mcp"], {
    execPath,
    exists,
    platform,
  });
  return { ...npx, local: false };
}

function pinnedCliVersion(root) {
  const manifest = JSON.parse(
    readFileSync(join(root, "frontend", "package.json"), "utf8"),
  );
  return manifest.devDependencies["@angular/cli"];
}

function main() {
  const { local, ...spec } = resolveLauncher(projectDir);
  if (!local) {
    console.error(
      "angular-cli MCP: frontend dependencies not installed; starting through npx.",
    );
  }
  launch(spec, "angular-cli");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
