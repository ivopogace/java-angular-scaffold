import { existsSync, readdirSync, rmdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Removes `dir` and its ancestors below `root` while they are empty or already gone. */
export function pruneEmptyParents(root, dir) {
  const stop = resolve(root);
  let current = resolve(dir);
  while (current !== stop && current.startsWith(stop)) {
    if (existsSync(current)) {
      if (readdirSync(current).length > 0) return;
      rmdirSync(current);
    }
    current = dirname(current);
  }
}
