import { createHash } from "node:crypto";
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Bytes a file is inspected for a NUL in to be called binary, as git does. */
const BINARY_PROBE_BYTES = 8000;

/** Converts CRLF line endings to LF. */
export function normalizeEol(text) {
  return text.replaceAll("\r\n", "\n");
}

/** SHA-256 (hex) of the file's text with CRLF normalised to LF. */
export function sha256Normalized(path) {
  return createHash("sha256")
    .update(normalizeEol(readFileSync(path, "utf8")))
    .digest("hex");
}

/** A file whose first bytes contain a NUL is binary and hashed byte for byte. */
const isBinary = (bytes) => bytes.subarray(0, BINARY_PROBE_BYTES).includes(0);

/** SHA-256 (hex) of the file's bytes, CRLF normalised to LF unless binary. */
function sha256File(path) {
  const bytes = readFileSync(path);
  const hashed = isBinary(bytes)
    ? bytes
    : Buffer.from(normalizeEol(bytes.toString("latin1")), "latin1");
  return createHash("sha256").update(hashed).digest("hex");
}

/**
 * SHA-256 (hex) of a folder: the hash of its `sha256sum`-style manifest, one
 * line `<sha256File of the file>  <path relative to the folder, forward
 * slashes>\n` per file, sorted by path. Any added, removed or edited file
 * changes it; line endings do not, nor do dotfiles and dot directories (OS and editor droppings
 * such as `.DS_Store`), which `globSync` skips.
 */
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

/**
 * Applies `edit` to the file's LF text and writes the result back with the
 * file's original line endings (CRLF if it contained any, else LF).
 */
export function rewritePreservingEol(path, edit) {
  const original = readFileSync(path, "utf8");
  const edited = edit(normalizeEol(original));
  writeFileSync(
    path,
    original.includes("\r\n") ? edited.replaceAll("\n", "\r\n") : edited,
  );
}
