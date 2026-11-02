import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  appEndpoint,
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

test("parseArgs accepts only --skip-frontend-build", () => {
  assert.deepEqual(parseArgs([]), { skipFrontendBuild: false });
  assert.deepEqual(parseArgs(["--skip-frontend-build"]), {
    skipFrontendBuild: true,
  });
  assert.match(parseArgs(["--keep"]).error, /Unknown argument: --keep/);
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
