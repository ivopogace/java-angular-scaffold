import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  appEndpoint,
  builtLocales,
  checkDockerfilePins,
  checkLocalePage,
  checkRootRedirect,
  defaultLocale,
  isUp,
  parseArgs,
  plan,
  postgresImage,
  publishedPort,
} from "./smoke-image.mjs";

const repoFile = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("parseArgs takes no arguments", () => {
  assert.deepEqual(parseArgs([]), {});
  assert.match(parseArgs(["--keep"]).error, /Unknown argument: --keep/);
});

test("the Dockerfile's base images follow .nvmrc and the Gradle toolchain", () => {
  const pins = {
    nvmrc: "26.13.0\n",
    javaConventions: "languageVersion = JavaLanguageVersion.of(25)",
  };
  const dockerfile = (node, jdk, jre) =>
    `FROM node:${node}-trixie-slim AS frontend\n` +
    `FROM eclipse-temurin:${jdk}-jdk-noble AS backend\n` +
    `FROM eclipse-temurin:${jre}-jre-noble\n`;
  assert.deepEqual(
    checkDockerfilePins(dockerfile("26.13.0", "25.0.5_8", "25.0.5_8"), pins),
    [],
  );
  assert.deepEqual(
    checkDockerfilePins(dockerfile("26.12.1", "26.0.1_3", "25.0.5_8"), pins),
    [
      "node:26.12.1-trixie-slim is not the Node 26.13.0 of .nvmrc",
      "eclipse-temurin:26.0.1_3-jdk-noble is not the Java 25 of the Gradle toolchain",
    ],
  );
  assert.deepEqual(checkDockerfilePins("FROM scratch\n", pins), [
    "the Dockerfile has no node stage",
    "the Dockerfile has no eclipse-temurin jdk stage",
    "the Dockerfile has no eclipse-temurin jre stage",
  ]);
  assert.deepEqual(
    checkDockerfilePins(repoFile("Dockerfile"), {
      nvmrc: repoFile(".nvmrc"),
      javaConventions: repoFile(
        "backend/build-logic/src/main/groovy/java-conventions.gradle",
      ),
    }),
    [],
  );
});

test("Postgres comes from compose.yaml's postgres service, the image bootRun uses", () => {
  assert.equal(
    postgresImage("services:\n  postgres:\n    image: postgres:18-alpine\n"),
    "postgres:18-alpine",
  );
  assert.equal(
    postgresImage(
      'services:\n  redis:\n    image: redis:7\n  postgres:\n    # pinned\n    image: "pgvector/pgvector:pg18"\n    ports:\n      - "5432:5432"\n',
    ),
    "pgvector/pgvector:pg18",
  );
  assert.match(postgresImage(repoFile("compose.yaml")), /\S:\S/);
  assert.throws(
    () => postgresImage("services:\n  redis:\n    image: redis:7\n"),
    /no postgres service with an image/,
  );
  assert.throws(
    () =>
      postgresImage(
        "services:\n  postgres:\n    ports: []\n  redis:\n    image: redis:7\n",
      ),
    /no postgres service with an image/,
  );
});

test("the app is published on loopback, or on the TCP daemon's host", () => {
  assert.deepEqual(appEndpoint(undefined), {
    host: "127.0.0.1",
    publish: "127.0.0.1::8080",
  });
  assert.deepEqual(appEndpoint("unix:///var/run/docker.sock"), {
    host: "127.0.0.1",
    publish: "127.0.0.1::8080",
  });
  assert.deepEqual(appEndpoint("tcp://docker:2375"), {
    host: "docker",
    publish: "8080",
  });
});

test("the published port is read from docker port output", () => {
  assert.equal(publishedPort("127.0.0.1:49153\n"), 49153);
  assert.equal(publishedPort("0.0.0.0:32768\n[::]:32768\n"), 32768);
  assert.throws(() => publishedPort(""), /No published port/);
});

test("one run's containers share a network named after its id and pass config by environment", () => {
  const run = plan({
    id: "abc",
    postgres: "postgres:18-alpine",
    publish: "127.0.0.1::8080",
  });
  assert.equal(run.network, "smoke-abc");
  assert.equal(run.db, "smoke-abc-db");
  assert.equal(run.app, "smoke-abc-app");
  assert.equal(run.dbRun.at(-1), "postgres:18-alpine");
  assert.equal(run.image, "smoke-abc");
  assert.deepEqual(run.build, [
    "build",
    "--file",
    "Dockerfile",
    "--tag",
    "smoke-abc",
    ".",
  ]);
  assert.equal(run.appRun.at(-1), "smoke-abc");
  assert.deepEqual(run.teardown, [
    ["rm", "--force", "--volumes", "smoke-abc-app", "smoke-abc-db"],
    ["network", "rm", "smoke-abc"],
    ["rmi", "--force", "smoke-abc"],
  ]);
  for (const args of [run.dbRun, run.appRun]) {
    assert.equal(args[args.indexOf("--network") + 1], "smoke-abc");
  }
  assert.ok(!run.dbRun.includes("--publish"));
  assert.equal(
    run.appRun[run.appRun.indexOf("--publish") + 1],
    "127.0.0.1::8080",
  );
  assert.ok(
    run.appRun.includes(
      "SPRING_DATASOURCE_URL=jdbc:postgresql://smoke-abc-db:5432/smoke",
    ),
  );
  assert.ok(run.appRun.includes("SPRING_DATASOURCE_USERNAME=smoke"));
  assert.ok(run.appRun.includes("SPRING_DATASOURCE_PASSWORD=smoke"));
  assert.deepEqual(run.dbReady.slice(0, 3), [
    "exec",
    "smoke-abc-db",
    "pg_isready",
  ]);
});

test("health is UP only for a status UP body", () => {
  assert.ok(isUp('{"status":"UP","groups":["liveness"]}'));
  assert.ok(!isUp('{"status":"DOWN"}'));
  assert.ok(!isUp("<html>"));
});

test("builtLocales lists the source locale and every translation", () => {
  const angular = (i18n) => JSON.stringify({ projects: { app: { i18n } } });
  assert.deepEqual(
    builtLocales(angular({ sourceLocale: "en", locales: { de: {}, fr: {} } })),
    ["en", "de", "fr"],
  );
  assert.deepEqual(builtLocales(angular({ sourceLocale: { code: "de" } })), [
    "de",
  ]);
  assert.deepEqual(builtLocales(repoFile("frontend/angular.json")).sort(), [
    "de",
    "en",
  ]);
});

test("defaultLocale reads SpaWebConfig's DEFAULT_LOCALE", () => {
  assert.equal(
    defaultLocale('static final String DEFAULT_LOCALE = "fr";'),
    "fr",
  );
  assert.throws(() => defaultLocale("class SpaWebConfig {}"), /DEFAULT_LOCALE/);
  const [config] = globSync(
    "backend/bootstrap/src/main/java/**/SpaWebConfig.java",
    { cwd: new URL("..", import.meta.url) },
  );
  assert.ok(config, "no SpaWebConfig.java");
  assert.equal(defaultLocale(repoFile(config)), "de");
});

test("GET / must redirect with a 302 to the default locale", () => {
  assert.equal(
    checkRootRedirect({ status: 302, location: "/de/" }, "de"),
    null,
  );
  assert.equal(
    checkRootRedirect(
      { status: 302, location: "http://localhost:8080/de/" },
      "de",
    ),
    null,
  );
  assert.match(
    checkRootRedirect({ status: 302, location: "/en/" }, "de"),
    /expected 302 to \/de\//,
  );
  assert.equal(
    checkRootRedirect({ status: 302, location: "/fr/" }, "fr"),
    null,
  );
  assert.match(
    checkRootRedirect({ status: 404, location: null }, "de"),
    /answered 404 to nowhere/,
  );
});

test("a locale page must be HTML with that locale's lang attribute", () => {
  const page = (
    body,
    contentType = "text/html;charset=UTF-8",
    status = 200,
  ) => ({
    status,
    contentType,
    body,
  });
  assert.equal(
    checkLocalePage("de", page('<!doctype html><html lang="de" data-x>')),
    null,
  );
  assert.match(
    checkLocalePage("de", page('<html lang="en">')),
    /no <html lang="de">/,
  );
  assert.match(
    checkLocalePage("de", page("{}", "application/problem+json", 404)),
    /answered 404/,
  );
});
