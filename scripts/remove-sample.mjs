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
 * `node scripts/remove-sample.mjs --refresh-hashes` in the same commit;
 * otherwise the hash test in `remove-sample.test.mjs` fails and removal would
 * refuse the edited sample as drifted.
 */
export const SAMPLE_FILES = [
  {
    path: "GLOSSARY.md",
    sha256: "2900849e295cf92e0d40934df01aa6f2beb98a9e408a5dad69e7673061f2e970",
  },
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
    sha256: "ea4339e8612f76c1b7fed5a6010dccc602dec79f297bc2491e7f34e7885e931a",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/in/web/ProductController.java",
    sha256: "8456a3d5652317463e597aee9b1f228ab6fb9df3149adb5d61211aa52468763e",
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
    sha256: "34c520862e3154a28b16c71cb763846d59a0536031b1e4daf067e807eca2426a",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/PublishRollbackIT.java",
    sha256: "ec5725250552bbcb4c8301dc5eba686d582ec4e4fbf40f6b353495ac3774b2c3",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/adapter/in/web/ProductControllerTest.java",
    sha256: "19d1e9ab41a2b86c3a4c4a4df090faefa79501fa855f702e8e5bd3a178cdfc1c",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/adapter/out/persistence/JdbcProductRepositoryIT.java",
    sha256: "8d3e8b8155935e00652cee3385913aa1044cb4845f97a7459cb8b5303d5219c8",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/CreateProduct.java",
    sha256: "4269c8bcaba7d5f0e2838d3414b1db0c2dd4ca3f40970683d97c01eb6f0d05c3",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/CreateProductCommand.java",
    sha256: "ab490841c3af12136e9701e988cadca4b46fb8f54a682dbd8c4f887a82e77b1e",
  },
  {
    path: "backend/core/src/main/java/io/scaffold/starter/catalog/application/port/in/FindProduct.java",
    sha256: "5d3fffb950dd639f39740d911294c21b3aadfe7a3bbdb7da3aa8ded10e89c419",
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
    sha256: "e92adfa8fd36bba03cd206d754a7a1587b33ad427cc318254fd1dddfc36585f7",
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
    sha256: "a9d49bed2215cab2a24c5a73446ddff64aea965ca830b30f1bb197b648ac9563",
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
    sha256: "43db1b076bc027b04f0128db0c4c1b3e18a1b08ed30e51ef8df98ad7bf577373",
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
    sha256: "357f994d1ad0e0a8cdbbd632002b9f85e91729e932b3d6ab2fc37ea3bdc3b4e5",
  },
  {
    path: "frontend/e2e/catalog.e2e.ts",
    sha256: "b9f7568fe92772c2089c213c1e19a4015ac5806c1228abf485da8c7c02663ae4",
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
    sha256: "8c446a2987bf8589ddbcded6c6aa740abf8f4776b410093a8c0d36be5b11e1e5",
  },
  {
    path: "frontend/src/app/catalog/catalog.service.ts",
    sha256: "de38f66c95cb8ee00101d7f004d60126930de24d630cbb62896d06b1efacb6d7",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.html",
    sha256: "93eb0ed39e0a4a83fbf0f757d1376fbd3766d1defcf9b986697a49572b58f674",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.scss",
    sha256: "6cbd202fa94e1c78c09596ffb68528141e9d16a67ab15f50c093d3ba6abc7846",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.spec.ts",
    sha256: "5eb513ae6922d45e172783caad9b739238f56ac79da411515ca1964000ccf1d6",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.ts",
    sha256: "1a0f117836ab62d91a6ee8dc0898de5227142f410baf5af0a1c7c3fd0a779d4e",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.html",
    sha256: "9f111ce27b67fe9e1cbd0c89e56872eab0ef9e1a0e42a36f4ea0dbbff3ef63f6",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.scss",
    sha256: "9e4478963f1904f439a130ad7705b418ebe8d0f13d2c8a02c0685a4f6b45b020",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.spec.ts",
    sha256: "fc5e6e247cb73a8ee2229feb1e4a42b31b898336d4ca1ecc5334cec36eea3932",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.ts",
    sha256: "e293081e771e40f54a0bd17a92be725963e9f2c6f9987f6752c7953c8813623a",
  },
];

/** Files that keep their content but lose every line containing the marker. */
export const MARKED_FILES = [
  "AGENTS.md",
  "frontend/src/app/app.routes.ts",
  "frontend/src/app/app.html",
];

const HELP = `Removes the catalog sample feature (backend area, frontend feature, migration, e2e specs, glossary).

Usage: node scripts/remove-sample.mjs [--refresh-hashes]

The script deletes a fixed list of files and refuses to run if any of them was
edited. Removal is a setup-time action: once a shared database has run the
sample migration (V0_9__catalog_sample.sql), remove the code by hand and add a
forward migration that drops the catalog tables.

  --refresh-hashes   re-record the hashes of SAMPLE_FILES after editing a sample file
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
