import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

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
