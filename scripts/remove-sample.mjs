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
    sha256: "9d0dfd9e7078f7c63c877847f11dff6ed7883294b865cb8f5289feec92c4a2f3",
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
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/out/persistence/JdbcProductRepository.java",
    sha256: "646ee6f597bab8926397eba58c45a6c9cce80c3b2f8cf6394f7ac1aeaf4e7c57",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/out/persistence/JdbcPublicationLog.java",
    sha256: "0e7666784dca9cb74253c2a96e7e00e499f3e9616f248f6011de9ffc14040e90",
  },
  {
    path: "backend/adapters/src/main/java/io/scaffold/starter/catalog/adapter/out/persistence/package-info.java",
    sha256: "92a738af8f24fee26ed45abc6499d411b2321715b028ecd3138b1163d3c1fb47",
  },
  {
    path: "backend/adapters/src/main/resources/db/migration/V0_9__catalog_sample.sql",
    sha256: "300e7bbb97ae3889ea7b4850be7248f4917f4f1a224bc40b18e68d9cfe75cd8b",
  },
  {
    path: "backend/adapters/src/main/resources/db/migration/V2__catalog_product_version.sql",
    sha256: "3c297d9b0068e493880d0e7744a294ddfb86b36dc5ffff5c0a46ee3a6f866c3f",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/CatalogFlowIT.java",
    sha256: "34c520862e3154a28b16c71cb763846d59a0536031b1e4daf067e807eca2426a",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/ConcurrentPublishIT.java",
    sha256: "4640f786e8f01b84ca9b8fe31e9c8cb9a74428292ac6bc09e13737f466771101",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/PublishRollbackIT.java",
    sha256: "47ba81ad183d92f8af39ccfde5c85e54b8d4f5fc76d8010d7b081ef88087ead7",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/adapter/in/web/ProductControllerTest.java",
    sha256: "4fb9186101c46f432d36a781a11673f1dc5ec5294c5cb43fd6c31528a97d4f4c",
  },
  {
    path: "backend/bootstrap/src/test/java/io/scaffold/starter/catalog/adapter/out/persistence/JdbcProductRepositoryIT.java",
    sha256: "31105f39ce541d624ed6a4bd99921ea9298a5e3dc5c5636fb4073f276751a4e0",
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
    sha256: "3297be8ffb7eac398be5337f492caae3d796c096609fe91f57e2b52feb32de0b",
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
    sha256: "140cc28b8e2d27a89aa6fc952dc62d260f737d581df6b71ee28f123dbe986d35",
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
    sha256: "17e7758ac73f57077c09a5aa0714f116deec5cabb4916b38871ae7b70dc2aa87",
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
    sha256: "305fba6424924b155905dab3c90cf44a4d5cd2b24a18dc14b2487c80012c5ae1",
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
    sha256: "11a283ee385482f441068031b6789a80166bb8bd0509619d7d7d4c0b1b1dcbe7",
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
    sha256: "4493e5997e0f5a167540a05c8412895dd0d623e680c4c0ec17dd2f05c730d74f",
  },
  {
    path: "backend/application-core/src/test/java/io/scaffold/starter/catalog/application/service/InMemoryProductRepository.java",
    sha256: "e3fa112cc659644a07bac552d1d1759ae280b9d8ee9970118b640f08df013c11",
  },
  {
    path: "backend/application-core/src/test/java/io/scaffold/starter/catalog/application/service/RecordingEventPublisher.java",
    sha256: "0c7dbde1b9a58e40c42c17b6104572d3af684efb3a372ecd631a7fe0bc1c930e",
  },
  {
    path: "backend/application-core/src/test/java/io/scaffold/starter/catalog/domain/model/ProductTest.java",
    sha256: "650ddc9aec4003b6e86be1d2153e3b7e4d0de6713000973691622bab6b9b3619",
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
    sha256: "41ac6c0b24ad8b515c628974f98d5312054bac178c76b6744d0e8bbd9c5c52b6",
  },
  {
    path: "frontend/src/app/catalog/product-list/product-list.ts",
    sha256: "db1c5f7d59f550607aeb7ef009072db04fb4d4c8802e5ab08c85851db6ef40b0",
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
sample migrations (V0_9__catalog_sample.sql, V2__catalog_product_version.sql),
remove the code by hand and add a forward migration that drops the catalog tables.

  --refresh-hashes   re-record the hashes of SAMPLE_FILES after editing a sample file
`;

const DRIFT_INSTRUCTIONS = `Sample files were edited; nothing was removed.
Removing them would no longer restore the shipped skeleton. If a shared
database has already applied the sample migrations, do not delete them:
remove the catalog code by hand and add a forward migration that drops
catalog_publication_log and catalog_product.`;

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
