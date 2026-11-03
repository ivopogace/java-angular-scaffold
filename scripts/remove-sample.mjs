#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeEol,
  rewritePreservingEol,
  sha256Normalized,
} from "./lib/text.mjs";
import { pruneEmptyParents } from "./lib/fs.mjs";

const MARKER = "sample:catalog";

/** Editing one of these files needs `node scripts/remove-sample.mjs --refresh-hashes` in the same commit. */
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
    sha256: "753ecfab584fe5efc3a2ee43701f2efb0a9986b48b4a377e87eb53a1595d3a7c",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/in/web/CreateProductRequest.java",
    sha256: "37059a3b9e258f23f4517c97c92234f7e6a871bbf917f4cb8b715d758142271f",
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
    sha256: "d799c1a56e5f375230941794949260f3d363df48b8192f9a11645630f6db6b1f",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/out/persistence/JooqProductRepository.java",
    sha256: "752b91f5354f62f899045d8dd596f7d003d933a4045aea4d6586528a4658a978",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/out/persistence/JooqPublicationLog.java",
    sha256: "d41e653b086e17e40384e5396d95d0b5257a55c2a8b04d2c856d6c277e4c92e5",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/out/persistence/package-info.java",
    sha256: "92a738af8f24fee26ed45abc6499d411b2321715b028ecd3138b1163d3c1fb47",
  },
  {
    path: "backend/adapters/src/generated/jooq/io/scaffold/starter/catalog/adapter/out/persistence/jooq/CatalogProduct.java",
    sha256: "175c8625e96643cb5e433753b38a7ed3182b3294d970153a077ff4dcd25fb501",
  },
  {
    path: "backend/adapters/src/generated/jooq/io/scaffold/starter/catalog/adapter/out/persistence/jooq/CatalogProductRecord.java",
    sha256: "f2b92532febcb9534f9c1ca0848d25c2b92b024137cea2b5b7ac873ffc788c44",
  },
  {
    path: "backend/adapters/src/generated/jooq/io/scaffold/starter/catalog/adapter/out/persistence/jooq/CatalogPublicationLog.java",
    sha256: "e593d2062eb86ed54ca9e85f8745ab4215e635b740857b38b4cee38f30360ca6",
  },
  {
    path: "backend/adapters/src/generated/jooq/io/scaffold/starter/catalog/adapter/out/persistence/jooq/CatalogPublicationLogRecord.java",
    sha256: "a3b58bf96ae3f0a3152f6940925a73208ef60fe6f3eb89c05408cb3bba7168bb",
  },
  {
    path: "backend/adapters/src/generated/jooq/io/scaffold/starter/catalog/adapter/out/persistence/jooq/DefaultCatalog.java",
    sha256: "65aa23e9c10aa41a74276e118e9696d02ef9f20b6e5ede952ae1623441ac5649",
  },
  {
    path: "backend/adapters/src/generated/jooq/io/scaffold/starter/catalog/adapter/out/persistence/jooq/Keys.java",
    sha256: "8568ef2e20d2d3d24bb59a3527d2505680a5f78c02ed93d2a3add12ed110e0b4",
  },
  {
    path: "backend/adapters/src/generated/jooq/io/scaffold/starter/catalog/adapter/out/persistence/jooq/Public.java",
    sha256: "e4a6be2ed1dbc029257587af801a73e66bb901585a3031ecbd45f71e4933b0cb",
  },
  {
    path: "backend/adapters/src/generated/jooq/io/scaffold/starter/catalog/adapter/out/persistence/jooq/Tables.java",
    sha256: "fac7ebd0227b0c53629182046320a4c1b567cb4e800b63288df916ef1f014dfb",
  },
  {
    path: "backend/adapters/src/main/resources/db/migration/V0_9__catalog_sample.sql",
    sha256: "300e7bbb97ae3889ea7b4850be7248f4917f4f1a224bc40b18e68d9cfe75cd8b",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/CatalogFlowIT.java",
    sha256: "d5e9cc232b62a6ea80d0ef676d5f44890e4e4becef997b28ce3e1781cc8b5469",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/PublishRollbackIT.java",
    sha256: "6f2b08a46841a092d03c2b34f3b1e17d8c48198125a2c16934ef998780e7e2e6",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/adapter/in/web/ProductControllerTest.java",
    sha256: "19d1e9ab41a2b86c3a4c4a4df090faefa79501fa855f702e8e5bd3a178cdfc1c",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/adapter/out/persistence/JooqProductRepositoryIT.java",
    sha256: "9540b51e2cc3c651798578e9c54a53b667a76044f8588488374f60c8dae163ef",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/CreateProduct.java",
    sha256: "4269c8bcaba7d5f0e2838d3414b1db0c2dd4ca3f40970683d97c01eb6f0d05c3",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/CreateProductCommand.java",
    sha256: "2bd0dab6d0c8eda68d8b1ed53383464b6d885ef96d77514f5f9731d06b96bacc",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/FindProduct.java",
    sha256: "5d3fffb950dd639f39740d911294c21b3aadfe7a3bbdb7da3aa8ded10e89c419",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/ListProducts.java",
    sha256: "63580d001b4d1d7cfa3161c72af54b1ebbc778f032ba1fdf8f0ae31006b46a23",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/ProductState.java",
    sha256: "c32489a87d66bed84ce4fab58760a717427d3294e834f5c870cc9a5a691a9096",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/ProductView.java",
    sha256: "bd4db1305377d6ab100cadd40384b741787becf76dff0bb97cae6341d8f8d76e",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/PublishOutcome.java",
    sha256: "5a1b0bf1e2c2bba1f0ba8e89c29e574b97c4c037c77f0d404ab076ba598ac293",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/PublishProduct.java",
    sha256: "84b1660810502a624f54574188773dbaf3888325e03da7d2eabc26a634397ee9",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/RecordProductPublication.java",
    sha256: "75e7c4ee30f36110505753e326161103babdd7541d8482fffd9b823d47bef2a5",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/RetireOutcome.java",
    sha256: "390cce92b6141bbd1bac46b512b43af1690deb56f64d89e7178f9a31e5199f69",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/RetireProduct.java",
    sha256: "3f237b73fdfc043d1801ae1a797b2cf6595457233312e8e07cc98f93086766f0",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/in/package-info.java",
    sha256: "e58b06be0f7a42b6a88df5e5b2ae3e2260e031d6a410bb2ad4a444093068a8d9",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/out/ProductRepository.java",
    sha256: "37e55bda9e195bb5e1e5c9d5994d9aeb4d5964a79be05a05873b0a59f9c2b272",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/out/PublicationLog.java",
    sha256: "eaa143c14b4f9f88b98e575b2dd5278a1b738d22157234e4c2afcfcd712c1286",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/port/out/package-info.java",
    sha256: "834bccbdf338224c574fc082dd153e73fadd910047a48017fcb62837b8c78ce1",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/service/CatalogService.java",
    sha256: "e92adfa8fd36bba03cd206d754a7a1587b33ad427cc318254fd1dddfc36585f7",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/application/service/PublicationRecorder.java",
    sha256: "a2a837403684bd4f3a1fc79fcf386d49f8f1b98494f33177d54e8128f468a828",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/domain/event/ProductPublished.java",
    sha256: "203bca9b392e547654c1a2500c64070826decba046cc948e27c594fbe545049f",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/domain/event/package-info.java",
    sha256: "c839c7c3de7c11c7ab31048dab55144310a6d3bece24a72685bf08bdf5b2e2c1",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/domain/id/ProductId.java",
    sha256: "10ade7510419a3998a9f95e268ffefd7d372609fc2e84be51548537bf2b45905",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/domain/id/package-info.java",
    sha256: "e2cb30e9aa3a7ec5f1537f28e07084a3a965cc852fc5607f2a9c7a737b70560f",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/domain/model/Product.java",
    sha256: "516510f37f42e0fd81117bdbc2c4e906434b5383a82da31d00e04884c71eae66",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/domain/model/ProductStatus.java",
    sha256: "649532412c6dbacda3bab5d5e9d96cef5f368ee13f96ca24f28dfb3ad64ec794",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/domain/model/PublishCheck.java",
    sha256: "ed498b347d78392d392a479da4717ed42086003c154242f7e39614289eedc3d1",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/domain/model/package-info.java",
    sha256: "1f25fba6b7154787c406d43607962b4b95146d7a5f3d454350cb2acd68424061",
  },
  {
    path: "backend/application-core/src/main/java/io/scaffold/starter/catalog/package-info.java",
    sha256: "5beeff8e32026103af71cfd1d6f5f7be49e9af2f160355052f89d08c4b30cd58",
  },
  {
    path: "backend/application-core/src/test/java/io/scaffold/starter/catalog/application/service/CatalogServiceTest.java",
    sha256: "43db1b076bc027b04f0128db0c4c1b3e18a1b08ed30e51ef8df98ad7bf577373",
  },
  {
    path: "backend/application-core/src/test/java/io/scaffold/starter/catalog/application/service/InMemoryProductRepository.java",
    sha256: "7cd8e9759f0b1427f5c38deacc61e37f095a2231874891c3b8564aba3cc018a0",
  },
  {
    path: "backend/application-core/src/test/java/io/scaffold/starter/catalog/application/service/RecordingEventPublisher.java",
    sha256: "0c7dbde1b9a58e40c42c17b6104572d3af684efb3a372ecd631a7fe0bc1c930e",
  },
  {
    path: "backend/application-core/src/test/java/io/scaffold/starter/catalog/domain/model/ProductTest.java",
    sha256: "357f994d1ad0e0a8cdbbd632002b9f85e91729e932b3d6ab2fc37ea3bdc3b4e5",
  },
  {
    path: "frontend/e2e/catalog.e2e.ts",
    sha256: "b9f7568fe92772c2089c213c1e19a4015ac5806c1228abf485da8c7c02663ae4",
  },
  {
    path: "frontend/e2e/real-backend/catalog.localized.real.e2e.ts",
    sha256: "7a6e82c0c8f26084882e2412d1d805729f35af43d8046584f083be59201fc1c1",
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
    sha256: "9ed0bee061fc2ff204ab6534fbaa5c562bed3a549b38af518a1eca38df7ca09b",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.html",
    sha256: "eb7c094b26b775de4515e1ed0333f2b6bc25a9c54bbf3e732119942d4c3e6648",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.scss",
    sha256: "6cbd202fa94e1c78c09596ffb68528141e9d16a67ab15f50c093d3ba6abc7846",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.spec.ts",
    sha256: "1bf2002c2ab9fb50c6394b56bf93a8741727edfa5b2fcfa8074bfd02d5f1411a",
  },
  {
    path: "frontend/src/app/catalog/product-form/product-form.ts",
    sha256: "9000b90878a2c566f90370401684be3421c27441f93e485110ea8fa136d1135b",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.html",
    sha256: "4deb9d823bcbfd09a2e2ca4bd529e5aa8f8593029eacaeb3a00fedbaf27f1a52",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.scss",
    sha256: "9e4478963f1904f439a130ad7705b418ebe8d0f13d2c8a02c0685a4f6b45b020",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.spec.ts",
    sha256: "0d74a2c90febe28b676efa5c970c749cca6658be688e045920ec7499d7f1c083",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.ts",
    sha256: "5816884ea60c0f8f1712cb6d10fd25f7141408bfc62b31810e08b5b303b0633a",
  },
];

/** Files that keep their content but lose every line containing the marker. */
export const MARKED_FILES = [
  "AGENTS.md",
  "frontend/src/app/app.routes.ts",
  "frontend/src/app/app.html",
  "frontend/src/locale/messages.de.xlf",
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

/** Re-runnable: a listed file already gone is skipped; nothing changes on `drifted` or `markerProblems`. */
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
