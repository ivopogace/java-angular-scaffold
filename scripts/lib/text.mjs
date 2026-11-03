import { createHash } from "node:crypto";
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Bytes a file is inspected for a NUL in to be called binary, as git does. */
const BINARY_PROBE_BYTES = 8000;

export function normalizeEol(text) {
  return text.replaceAll("\r\n", "\n");
}

export function sha256Normalized(path) {
  return createHash("sha256")
    .update(normalizeEol(readFileSync(path, "utf8")))
    .digest("hex");
}

const isBinary = (bytes) => bytes.subarray(0, BINARY_PROBE_BYTES).includes(0);

function sha256File(path) {
  const bytes = readFileSync(path);
  const hashed = isBinary(bytes)
    ? bytes
    : Buffer.from(normalizeEol(bytes.toString("latin1")), "latin1");
  return createHash("sha256").update(hashed).digest("hex");
}

/** Line endings and dotfiles (which `globSync` skips) do not change the hash. */
export function sha256Folder(dir) {
  const manifest = globSync("**", { cwd: dir, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const full = join(entry.parentPath, entry.name);
      return [relative(dir, full).split(sep).join("/"), full];
    })
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, full]) => `${sha256File(full)}  ${path}\n`)
    .join("");
  return createHash("sha256").update(manifest).digest("hex");
}

/** `edit` sees LF text; the result is written back with the file's original line endings. */
export function rewritePreservingEol(path, edit) {
  const original = readFileSync(path, "utf8");
  const edited = edit(normalizeEol(original));
  writeFileSync(
    path,
    original.includes("\r\n") ? edited.replaceAll("\n", "\r\n") : edited,
  );
}
