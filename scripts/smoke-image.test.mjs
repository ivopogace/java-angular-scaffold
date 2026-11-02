import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  appEndpoint,
  buildPlan,
  checkDockerfilePins,
  checkLocalePage,
  checkRootRedirect,
  imageName,
  isUp,
  parseArgs,
  plan,
  postgresImage,
  publishedPort,
} from "./smoke-image.mjs";

const repoFile = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("parseArgs takes --builder and --skip-frontend-build, buildpacks by default", () => {
  assert.deepEqual(parseArgs([]), {
    skipFrontendBuild: false,
    builder: "buildpacks",
  });
  assert.deepEqual(parseArgs(["--skip-frontend-build"]), {
    skipFrontendBuild: true,
    builder: "buildpacks",
  });
  assert.deepEqual(parseArgs(["--builder", "dockerfile"]), {
    skipFrontendBuild: false,
    builder: "dockerfile",
  });
  assert.deepEqual(
    parseArgs(["--builder=buildpacks", "--skip-frontend-build"]),
    {
      skipFrontendBuild: true,
      builder: "buildpacks",
    },
  );
  assert.match(parseArgs(["--keep"]).error, /Unknown argument: --keep/);
  assert.match(
    parseArgs(["--builder", "jib"]).error,
    /--builder takes buildpacks or dockerfile, not jib/,
  );
  assert.match(parseArgs(["--builder"]).error, /not nothing/);
});

test("buildpacks builds the frontend, unless skipped, then bootBuildImage", () => {
  const options = {
    builder: "buildpacks",
    image: "acme-orders:1.0.0",
    skipFrontendBuild: false,
    platform: "linux",
  };
  const full = buildPlan(options);
  assert.equal(full.image, "acme-orders:1.0.0");
  assert.deepEqual(
    full.steps.map((s) => [s.command, s.args, s.cwd]),
    [
      ["npm", ["run", "build"], "frontend"],
      ["./gradlew", [":bootstrap:bootBuildImage"], "backend"],
    ],
  );
  const skipped = buildPlan({ ...options, skipFrontendBuild: true });
  assert.deepEqual(
    skipped.steps.map((s) => s.name),
    ["image build"],
  );
  assert.equal(
    buildPlan({ ...options, platform: "win32" }).steps.at(-1).command,
    "gradlew.bat",
  );
});

test("the Dockerfile builds from the root under its own tag, frontend included", () => {
  for (const skipFrontendBuild of [false, true]) {
    const build = buildPlan({
      builder: "dockerfile",
      image: "acme-orders:1.0.0",
      skipFrontendBuild,
      platform: "linux",
    });
    assert.equal(build.image, "acme-orders:1.0.0-dockerfile");
    assert.deepEqual(
      build.steps.map((s) => [s.command, s.args, s.cwd]),
      [
        [
          "docker",
          [
            "build",
            "--file",
            "Dockerfile",
            "--tag",
            "acme-orders:1.0.0-dockerfile",
            ".",
          ],
          ".",
        ],
      ],
    );
  }
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

test("the image name is the Gradle project name and version", () => {
  assert.equal(
    imageName(
      "include 'core'\nrootProject.name = 'acme-orders'\n",
      "allprojects {\n    group = 'com.acme'\n    version = '1.2.3'\n}\n",
    ),
    "acme-orders:1.2.3",
  );
  assert.throws(() => imageName("", "version = '1'"), /rootProject\.name/);
});

test("the image name is readable from this repository's build", () => {
  assert.match(
    imageName(
      repoFile("backend/settings.gradle"),
      repoFile("backend/build.gradle"),
    ),
    /^[a-z][a-z0-9-]*:[\w.-]+$/,
  );
});

test("Postgres comes from compose.yaml, the image bootRun uses", () => {
  assert.equal(
    postgresImage("services:\n  postgres:\n    image: postgres:18-alpine\n"),
    "postgres:18-alpine",
  );
  assert.equal(postgresImage('    image: "postgres:17"\n'), "postgres:17");
  assert.match(postgresImage(repoFile("compose.yaml")), /^postgres:/);
  assert.throws(() => postgresImage("services: {}\n"), /no image/);
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
    image: "acme-orders:1.0.0",
    postgres: "postgres:18-alpine",
    publish: "127.0.0.1::8080",
  });
  assert.equal(run.network, "smoke-abc");
  assert.equal(run.db, "smoke-abc-db");
  assert.equal(run.app, "smoke-abc-app");
  assert.equal(run.dbRun.at(-1), "postgres:18-alpine");
  assert.equal(run.appRun.at(-1), "acme-orders:1.0.0");
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

test("GET / must redirect with a 302 to /de/", () => {
  assert.equal(checkRootRedirect({ status: 302, location: "/de/" }), null);
  assert.equal(
    checkRootRedirect({ status: 302, location: "http://localhost:8080/de/" }),
    null,
  );
  assert.match(
    checkRootRedirect({ status: 302, location: "/en/" }),
    /expected 302 to \/de\//,
  );
  assert.match(
    checkRootRedirect({ status: 404, location: null }),
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
