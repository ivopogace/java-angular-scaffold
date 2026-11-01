#!/usr/bin/env node
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeEol,
  rewritePreservingEol,
  sha256Normalized,
} from "./lib/text.mjs";

const MARKER = "sample:catalog";

/**
 * Every file that is wholly part of the `catalog` sample, with the SHA-256 of
 * its LF-normalised text as shipped. Any edit to one of these files needs
 * `node scripts/remove-sample.mjs --refresh-hashes` in the same commit; the
 * template CI `skeleton` job fails otherwise.
 */
export const SAMPLE_FILES = [
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/in/event/ProductPublishedListener.java",
    sha256: "d8463e15e859416c42428ba20a7886424073ad1363b0ce963cdfd6c9b8051a35",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/in/event/package-info.java",
    sha256: "2c8a618fa1802688e01c6b1aedd56281d70534ecb0f8f8095c655ed43badcfa3",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/in/web/CreateProductRequest.java",
    sha256: "a4df6e4e36481b37cca9ad969e0cb546d9aba17c139f8a0706dcba9ccd31dbcf",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/in/web/ProductController.java",
    sha256: "7dfc887e8767ad602d492040459e5c2e25262631b2666c9d4c5448504b6b8add",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/in/web/ProductResponse.java",
    sha256: "e2fca2131cf8ae9f36399fcf11a105fc329f8a49fe267c47ca1376d87cc26500",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/in/web/package-info.java",
    sha256: "6aa98ab492fff3b7eca2e7c0c17649567522c0f70b4c18229266af6c4324b6ca",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/out/persistence/JdbcProductRepository.java",
    sha256: "03b612e57ca1db1c28fe1237e579767ec9823a085f1fd69d77e823052898edaa",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/out/persistence/JdbcPublicationLog.java",
    sha256: "0e7666784dca9cb74253c2a96e7e00e499f3e9616f248f6011de9ffc14040e90",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/out/persistence/package-info.java",
    sha256: "1bd8afaadac10e000d32db8777ad864e98448eb1dfb93d054596a850a2bc40d1",
  },
  {
    path: "backend/adapters/src/main/resources/db/migration/V0_9__catalog_sample.sql",
    sha256: "300e7bbb97ae3889ea7b4850be7248f4917f4f1a224bc40b18e68d9cfe75cd8b",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/CatalogFlowIT.java",
    sha256: "b660e7ab88055a4e8b3203e5a0290d64b7c4a4ad507967d1ba0afc10a3e5866e",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/PublishRollbackIT.java",
    sha256: "f5c049c56432200a860238f22ae10fb2e03dc1796a2be6d8317e22f566725100",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/adapter/in/web/ProductControllerTest.java",
    sha256: "2c589a3d9d4260d4a98e211bbf4f589226cf7dbfbfffd180378fb4a1d5fcfb4f",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/adapter/out/persistence/JdbcProductRepositoryIT.java",
    sha256: "136dec8fe2afe3485e74edb812f7fa3177758114019205e9fa53634c41527eb9",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/CreateProduct.java",
    sha256: "0877288adf71dad356ac99c0f02b2e0bb09157e3eb89de4c7bd8088411c984c4",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/CreateProductCommand.java",
    sha256: "04a232ee24faaf5552c57ed6cd4b3fe343ef6d886a4163742de56a134dc67720",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/ListProducts.java",
    sha256: "63580d001b4d1d7cfa3161c72af54b1ebbc778f032ba1fdf8f0ae31006b46a23",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/ProductState.java",
    sha256: "c32489a87d66bed84ce4fab58760a717427d3294e834f5c870cc9a5a691a9096",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/ProductView.java",
    sha256: "3b4438f3714a6479d6b8449d9a9fcd19aa04a7fd9d674998d45c60df09307feb",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/PublishOutcome.java",
    sha256: "5a1b0bf1e2c2bba1f0ba8e89c29e574b97c4c037c77f0d404ab076ba598ac293",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/PublishProduct.java",
    sha256: "84b1660810502a624f54574188773dbaf3888325e03da7d2eabc26a634397ee9",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/RecordProductPublication.java",
    sha256: "75e7c4ee30f36110505753e326161103babdd7541d8482fffd9b823d47bef2a5",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/RetireOutcome.java",
    sha256: "390cce92b6141bbd1bac46b512b43af1690deb56f64d89e7178f9a31e5199f69",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/RetireProduct.java",
    sha256: "3f237b73fdfc043d1801ae1a797b2cf6595457233312e8e07cc98f93086766f0",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/package-info.java",
    sha256: "e58b06be0f7a42b6a88df5e5b2ae3e2260e031d6a410bb2ad4a444093068a8d9",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/out/ProductRepository.java",
    sha256: "37e55bda9e195bb5e1e5c9d5994d9aeb4d5964a79be05a05873b0a59f9c2b272",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/out/PublicationLog.java",
    sha256: "eaa143c14b4f9f88b98e575b2dd5278a1b738d22157234e4c2afcfcd712c1286",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/out/package-info.java",
    sha256: "834bccbdf338224c574fc082dd153e73fadd910047a48017fcb62837b8c78ce1",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/service/CatalogService.java",
    sha256: "9cf1760d2f8f2e7da632af55a826c4b5e6302e64214cee46cd634f257a9c70a4",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/service/PublicationRecorder.java",
    sha256: "a2a837403684bd4f3a1fc79fcf386d49f8f1b98494f33177d54e8128f468a828",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/domain/event/ProductPublished.java",
    sha256: "94d75ae8497d6e1a92df925d004e4319175025a5d2eda4de838822c8b83c8d42",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/domain/event/package-info.java",
    sha256: "c839c7c3de7c11c7ab31048dab55144310a6d3bece24a72685bf08bdf5b2e2c1",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/domain/id/ProductId.java",
    sha256: "a4dcb80628a60e107b946e64283df22ebc55caf07fe8e4e32fe96178f61ecf1b",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/domain/id/package-info.java",
    sha256: "e2cb30e9aa3a7ec5f1537f28e07084a3a965cc852fc5607f2a9c7a737b70560f",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/domain/model/Product.java",
    sha256: "c77ba1614dc98bebc11cc8a7a005386146326386426a467d64b5dec2a2a1b2e5",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/domain/model/ProductStatus.java",
    sha256: "649532412c6dbacda3bab5d5e9d96cef5f368ee13f96ca24f28dfb3ad64ec794",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/domain/model/PublishCheck.java",
    sha256: "a1fe4b2f34ff062d2aeb85922ee7439e23b4005fabb08900aa23d529b40927f3",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/domain/model/package-info.java",
    sha256: "8bb8d1919afed8749dd72a9f49e0e2f0232a4ee1bffc6f99bcc0391d4bfdecc7",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/package-info.java",
    sha256: "a1a96703fdfd219b94612a5b67ecff0ff5ca1af48b1db4c4b4916a1b8421184b",
  },
  {
    path: "backend/core/src/test/java/io/scaffold/starter/catalog/application/service/CatalogServiceTest.java",
    sha256: "024785ec61c758dc324bd76029bb694e3b2c32d69f25a1be3ff8cdf64535b64c",
  },
  {
    path: "backend/core/src/test/java/io/scaffold/starter/catalog/application/service/InMemoryProductRepository.java",
    sha256: "7cd8e9759f0b1427f5c38deacc61e37f095a2231874891c3b8564aba3cc018a0",
  },
  {
    path: "backend/core/src/test/java/io/scaffold/starter/catalog/application/service/RecordingEventPublisher.java",
    sha256: "0c7dbde1b9a58e40c42c17b6104572d3af684efb3a372ecd631a7fe0bc1c930e",
  },
  {
    path: "backend/core/src/test/java/io/scaffold/starter/catalog/domain/model/ProductTest.java",
    sha256: "d0311c0212395159a905da10b29c422c314125b152dbc890769e2a2bd70152fe",
  },
  {
    path: "frontend/e2e/catalog.e2e.ts",
    sha256: "7816b141968199f5b59c5beb44b2ffc3800bb4670798ffa5caab5bc663b92189",
  },
  {
    path: "frontend/e2e/real-backend/catalog.real.e2e.ts",
    sha256: "508682fee63e8b15ea3dc11a5a0d738a28c551e8dd918641ca0ac37dbe0ef976",
  },
  {
    path: "frontend/src/app/catalog/catalog.model.ts",
    sha256: "f4115647ba9a79b8833298493bec1fbaf63161211bdaf9460b5e795956644c3f",
  },
  {
    path: "frontend/src/app/catalog/catalog.service.spec.ts",
    sha256: "3c790ef997d96b9f0f643210f66201c5d07a812c652f7f2d2e323036add19eb8",
  },
  {
    path: "frontend/src/app/catalog/catalog.service.ts",
    sha256: "79963d42a84449ff3536c137aff6e11492103a8645d8789f2f25f21e1158fb72",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.html",
    sha256: "1a67520d620f1f3aa2dde7612bb4adf867588849aff5e71027e3c62a7401f209",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.scss",
    sha256: "6cbd202fa94e1c78c09596ffb68528141e9d16a67ab15f50c093d3ba6abc7846",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.spec.ts",
    sha256: "c08cb6ad8d912f6777aba8d387b3b2b38c4e592db1c04ce85ed3601580f2e08b",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.ts",
    sha256: "1a0f117836ab62d91a6ee8dc0898de5227142f410baf5af0a1c7c3fd0a779d4e",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.html",
    sha256: "d561172f963ae7cb37073101b30d226540b8d51c1c7526c254c8e9f512733361",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.scss",
    sha256: "9e4478963f1904f439a130ad7705b418ebe8d0f13d2c8a02c0685a4f6b45b020",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.spec.ts",
    sha256: "ce790993026c273ad1503ee6cba8bcd37eaa3cd5e9eea05ca0793d29beec14d2",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.ts",
    sha256: "2cf8b7458c54f892f2f822d0517b2712b56676f3075d6efd505aa7ae73135109",
  },
];

/** Files that keep their content but lose every line containing the marker. */
export const MARKED_FILES = [
  "frontend/src/app/app.routes.ts",
  "frontend/src/app/app.html",
];

const HELP = `Removes the catalog sample feature (backend area, frontend feature, migration, e2e specs).

Usage: node scripts/remove-sample.mjs [--refresh-hashes]

The script deletes a fixed list of files and refuses to run if any of them was
edited. Removal is a setup-time action: once a shared database has run the
sample migration (V0_9__catalog_sample.sql), remove the code by hand and add a
forward migration that drops the catalog tables.

  --refresh-hashes   re-record the hashes of SAMPLE_FILES (template maintainers only)
`;

const DRIFT_INSTRUCTIONS = `Sample files were edited; nothing was removed.
Removing them would no longer restore the shipped skeleton. If a shared
database has already applied V0_9__catalog_sample.sql, do not delete that
migration: remove the catalog code by hand and add a forward migration that
drops catalog_publication_log and catalog_product.`;

/**
 * Removes the sample under `root`. Safe to re-run after an interruption: a
 * listed file that is already gone is skipped; only a hash mismatch is drift.
 *
 * @param rm deletes one file; injectable so tests can simulate a failure
 * @returns `{ removed }` the files deleted by this call (root-relative,
 *   forward slashes); `{ drifted }` listed files whose content was edited;
 *   `{ markerProblems }` lines still referencing the catalog after the marker
 *   lines would be stripped (`{ file, line, text }`); `{ failed }` a deletion
 *   error with the files `removed` before it and those `remaining`;
 *   `{ alreadyRemoved: true }` when no sample file or marker line is left.
 *   Nothing is deleted or rewritten for `drifted` and `markerProblems`.
 */
export function removeSample(root, { rm = rmSync } = {}) {
  const present = SAMPLE_FILES.filter((f) => existsSync(join(root, f.path)));
  const marked = MARKED_FILES.filter((f) => existsSync(join(root, f)));
  const hasMarkers = marked.some((f) => markerLines(join(root, f)) > 0);
  if (present.length === 0 && !hasMarkers) return { alreadyRemoved: true };

  const drifted = present
    .filter((f) => sha256Normalized(join(root, f.path)) !== f.sha256)
    .map((f) => f.path);
  if (drifted.length > 0) return { drifted };

  const markerProblems = marked.flatMap((file) =>
    leftoverReferences(
      file,
      stripMarkerLines(normalizeEol(readFileSync(join(root, file), "utf8"))),
    ),
  );
  if (markerProblems.length > 0) return { markerProblems };

  const removed = [];
  try {
    for (const { path } of present) {
      rm(join(root, path));
      removed.push(path);
    }
    for (const { path } of SAMPLE_FILES) {
      pruneEmptyParents(root, dirname(join(root, path)));
    }
    for (const file of marked) {
      rewritePreservingEol(join(root, file), stripMarkerLines);
    }
  } catch (error) {
    const remaining = present
      .map((f) => f.path)
      .filter((p) => !removed.includes(p));
    return { failed: { error, removed, remaining } };
  }
  return { removed };
}

const stripMarkerLines = (text) =>
  text
    .split("\n")
    .filter((line) => !line.includes(MARKER))
    .join("\n");

function leftoverReferences(file, strippedText) {
  return strippedText
    .split("\n")
    .flatMap((text, index) =>
      text.includes("./catalog/") || text.includes("/catalog")
        ? [{ file, line: index + 1, text: text.trim() }]
        : [],
    );
}

function markerLines(file) {
  return normalizeEol(readFileSync(file, "utf8"))
    .split("\n")
    .filter((line) => line.includes(MARKER)).length;
}

/** Removes `dir` and its ancestors below `root` while they are empty or already gone. */
function pruneEmptyParents(root, dir) {
  const stop = resolve(root);
  let current = resolve(dir);
  while (current !== stop && current.startsWith(stop)) {
    if (existsSync(current)) {
      if (!isEmpty(current)) return;
      rmdirSync(current);
    }
    current = dirname(current);
  }
}

const isEmpty = (dir) => readdirSync(dir).length === 0;

/** Rewrites the recorded hashes in this script from the files on disk. */
export function refreshHashes(root, scriptPath) {
  const missing = SAMPLE_FILES.filter(
    (f) => !existsSync(join(root, f.path)),
  ).map((f) => f.path);
  if (missing.length > 0) return { missing };
  rewritePreservingEol(scriptPath, (source) =>
    SAMPLE_FILES.reduce((text, { path }) => {
      const at = text.indexOf(`path: ${JSON.stringify(path)},`);
      const start = text.indexOf('sha256: "', at) + 'sha256: "'.length;
      return (
        text.slice(0, start) +
        sha256Normalized(join(root, path)) +
        text.slice(start + 64)
      );
    }, source),
  );
  return { refreshed: SAMPLE_FILES.length };
}

function main(argv, root, scriptPath) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return 0;
  }
  if (argv.includes("--refresh-hashes")) {
    const result = refreshHashes(root, scriptPath);
    if (result.missing) {
      console.error(
        `Cannot refresh; missing:\n  ${result.missing.join("\n  ")}`,
      );
      return 1;
    }
    console.log(`Refreshed ${result.refreshed} hashes.`);
    return 0;
  }
  const result = removeSample(root);
  if (result.alreadyRemoved) {
    console.log("Sample already removed.");
    return 0;
  }
  if (result.drifted) {
    console.error(`${DRIFT_INSTRUCTIONS}\n\nChanged:`);
    for (const path of result.drifted) console.error(`  ${path}`);
    return 1;
  }
  if (result.markerProblems) {
    console.error(
      "A marked file no longer matches the shipped layout; nothing was removed.\nEach line below still references the catalog once the marker lines are stripped:",
    );
    for (const { file, line, text } of result.markerProblems) {
      console.error(`  ${file}:${line}: ${text}`);
    }
    return 1;
  }
  if (result.failed) {
    const { error, removed, remaining } = result.failed;
    console.error(
      `Removal stopped: ${error.message}\nAlready removed (${removed.length}); fix the cause and re-run to finish. Still to remove (${remaining.length}):`,
    );
    for (const path of remaining) console.error(`  ${path}`);
    return 1;
  }
  console.log(
    `Removed the catalog sample (${result.removed.length} files, marker lines in ${MARKED_FILES.join(", ")}).`,
  );
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const scriptPath = fileURLToPath(import.meta.url);
  process.exitCode = main(
    process.argv.slice(2),
    resolve(dirname(scriptPath), ".."),
    scriptPath,
  );
}
