#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { globSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { runCommand } from "./verify.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const USAGE = `Usage: node scripts/smoke-image.mjs

Builds the production image from the repository's Dockerfile, starts it with
Postgres on a throwaway Docker network, checks health and the localized SPA,
and removes everything it started.`;

const APP_PORT = 8080;
const SPA_WEB_CONFIG = "backend/bootstrap/src/main/java/**/SpaWebConfig.java";
const DB = { name: "smoke", user: "smoke", password: "smoke" };
const HEALTH_TIMEOUT_MS = 180_000;
const DB_TIMEOUT_MS = 60_000;
const POLL_MS = 1_000;

export function parseArgs(argv) {
  return argv.length === 0
    ? {}
    : { error: `Unknown argument: ${argv[0]}\n${USAGE}` };
}

/** `rootProject.name:version`, the tag the smoke test builds. */
export function imageName(settingsGradle, buildGradle) {
  const name = settingsGradle.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
  const version = buildGradle.match(/^\s*version\s*=\s*['"]([^'"]+)['"]/m);
  if (!name || !version) {
    throw new Error(
      "Cannot read rootProject.name from backend/settings.gradle or version from backend/build.gradle",
    );
  }
  return `${name[1]}:${version[1]}`;
}

export function buildStep(image) {
  return {
    name: "image build",
    command: "docker",
    args: ["build", "--file", "Dockerfile", "--tag", image, "."],
    cwd: ".",
  };
}

/** Renovate bumps the base images' patch versions; the Node version and the Java major move by hand. */
export function checkDockerfilePins(dockerfile, { nvmrc, javaConventions }) {
  const from = [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map((m) => m[1]);
  const node = nvmrc.trim().replace(/^v/, "");
  const java = javaConventions.match(/JavaLanguageVersion\.of\((\d+)\)/)?.[1];
  const problems = [];
  const nodeImages = from.filter((image) => image.startsWith("node:"));
  if (nodeImages.length === 0)
    problems.push("the Dockerfile has no node stage");
  for (const image of nodeImages) {
    if (!image.startsWith(`node:${node}-`)) {
      problems.push(`${image} is not the Node ${node} of .nvmrc`);
    }
  }
  for (const kind of ["jdk", "jre"]) {
    const images = from.filter((image) =>
      new RegExp(`^eclipse-temurin:[\\d._]+-${kind}-`).test(image),
    );
    if (images.length === 0) {
      problems.push(`the Dockerfile has no eclipse-temurin ${kind} stage`);
    }
    for (const image of images) {
      if (!image.startsWith(`eclipse-temurin:${java}.`)) {
        problems.push(
          `${image} is not the Java ${java} of the Gradle toolchain`,
        );
      }
    }
  }
  return problems;
}

/** The Postgres image of `compose.yaml`, so the smoke test runs the database `bootRun` runs. */
export function postgresImage(composeYaml) {
  const image = composeYaml.match(/^\s*image:\s*["']?([^\s"']+)/m);
  if (!image) throw new Error("compose.yaml names no image");
  return image[1];
}

/** The daemon's host for a TCP `DOCKER_HOST` (Docker-in-Docker in CI), else loopback. */
export function appEndpoint(dockerHost) {
  const tcp = dockerHost?.match(/^tcp:\/\/([^:/]+)/);
  return tcp
    ? { host: tcp[1], publish: String(APP_PORT) }
    : { host: "127.0.0.1", publish: `127.0.0.1::${APP_PORT}` };
}

/** The host port from `docker port <container> 8080` output, such as `127.0.0.1:49153`. */
export function publishedPort(dockerPortOutput) {
  const port = dockerPortOutput.match(/:(\d+)\s*$/m);
  if (!port) throw new Error(`No published port in: ${dockerPortOutput}`);
  return Number(port[1]);
}

/** Named after `id`, so parallel runs never collide. */
export function plan({ id, image, postgres, publish }) {
  const network = `smoke-${id}`;
  const db = `${network}-db`;
  const app = `${network}-app`;
  return {
    network,
    db,
    app,
    dbRun: [
      "run",
      "--detach",
      "--name",
      db,
      "--network",
      network,
      "--env",
      `POSTGRES_DB=${DB.name}`,
      "--env",
      `POSTGRES_USER=${DB.user}`,
      "--env",
      `POSTGRES_PASSWORD=${DB.password}`,
      postgres,
    ],
    // Over TCP: the image's init phase runs a temporary server on the Unix socket only.
    dbReady: [
      "exec",
      db,
      "pg_isready",
      "--host",
      "127.0.0.1",
      "--username",
      DB.user,
      "--dbname",
      DB.name,
    ],
    appRun: [
      "run",
      "--detach",
      "--name",
      app,
      "--network",
      network,
      "--publish",
      publish,
      "--env",
      `SPRING_DATASOURCE_URL=jdbc:postgresql://${db}:5432/${DB.name}`,
      "--env",
      `SPRING_DATASOURCE_USERNAME=${DB.user}`,
      "--env",
      `SPRING_DATASOURCE_PASSWORD=${DB.password}`,
      image,
    ],
  };
}

/** Whether an `/actuator/health` body reports UP. */
export function isUp(body) {
  try {
    return JSON.parse(body).status === "UP";
  } catch {
    return false;
  }
}

/** The locales `angular.json` builds: the source locale, then each translation. */
export function builtLocales(angularJson) {
  const { i18n } = Object.values(JSON.parse(angularJson).projects)[0];
  const source =
    typeof i18n.sourceLocale === "object"
      ? i18n.sourceLocale.code
      : i18n.sourceLocale;
  return [source, ...Object.keys(i18n.locales ?? {})];
}

/** `SpaWebConfig.DEFAULT_LOCALE`, where `/` sends a request without a language preference. */
export function defaultLocale(spaWebConfig) {
  const locale = spaWebConfig.match(/DEFAULT_LOCALE\s*=\s*"([^"]+)"/);
  if (!locale) throw new Error("SpaWebConfig.java declares no DEFAULT_LOCALE");
  return locale[1];
}

export function checkRootRedirect({ status, location }, locale) {
  const path = location && new URL(location, "http://app").pathname;
  return status === 302 && path === `/${locale}/`
    ? null
    : `GET / answered ${status} to ${location ?? "nowhere"}; expected 302 to /${locale}/`;
}

export function checkLocalePage(locale, { status, contentType, body }) {
  if (status !== 200 || !contentType?.startsWith("text/html")) {
    return `GET /${locale}/ answered ${status} ${contentType ?? ""}; expected 200 text/html`;
  }
  return new RegExp(`<html[^>]*\\slang="${locale}"`).test(body)
    ? null
    : `GET /${locale}/ serves no <html lang="${locale}">`;
}

function docker(args, { quiet = false } = {}) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", quiet ? "ignore" : "inherit"],
  });
}

async function waitFor(what, timeoutMs, probe) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await sleep(POLL_MS);
  }
  throw new Error(`${what} not ready after ${timeoutMs / 1000} s`);
}

function running(container) {
  return docker(["inspect", "--format", "{{.State.Running}}", container], {
    quiet: true,
  }).trim();
}

async function step(name, command, args, cwd) {
  console.log(`\n> ${name}: ${command} ${args.join(" ")}  (${cwd})`);
  if ((await runCommand({ command, args, cwd })) === 0) return true;
  console.error(`✘ image smoke test: ${name} failed`);
  return false;
}

async function smoke(names, baseUrl, { locales, fallback }) {
  await waitFor("Postgres", DB_TIMEOUT_MS, () => {
    try {
      docker(names.dbReady, { quiet: true });
      return true;
    } catch {
      return false;
    }
  });
  docker(names.appRun);
  const port = publishedPort(docker(["port", names.app, String(APP_PORT)]));
  const url = `${baseUrl}:${port}`;
  console.log(`\n> waiting for ${url}/actuator/health`);
  await waitFor("/actuator/health", HEALTH_TIMEOUT_MS, async () => {
    if (running(names.app) !== "true") {
      throw new Error("the app container exited");
    }
    try {
      return isUp(await (await fetch(`${url}/actuator/health`)).text());
    } catch {
      return false;
    }
  });
  const root = await fetch(`${url}/`, { redirect: "manual" });
  const problems = [
    checkRootRedirect(
      { status: root.status, location: root.headers.get("location") },
      fallback,
    ),
  ];
  for (const locale of locales) {
    const page = await fetch(`${url}/${locale}/`);
    problems.push(
      checkLocalePage(locale, {
        status: page.status,
        contentType: page.headers.get("content-type"),
        body: await page.text(),
      }),
    );
  }
  const failed = problems.filter(Boolean);
  if (failed.length > 0) throw new Error(failed.join("\n"));
}

function teardown(names) {
  for (const args of [
    ["rm", "--force", "--volumes", names.app, names.db],
    ["network", "rm", names.network],
  ]) {
    try {
      docker(args, { quiet: true });
    } catch {
      // Not created, or already gone.
    }
  }
}

async function main(argv) {
  const args = parseArgs(argv);
  if ("error" in args) {
    console.error(args.error);
    return 2;
  }
  const read = (file) => readFileSync(join(root, file), "utf8");
  const problems = checkDockerfilePins(read("Dockerfile"), {
    nvmrc: read(".nvmrc"),
    javaConventions: read(
      "backend/build-logic/src/main/groovy/java-conventions.gradle",
    ),
  });
  if (problems.length > 0) {
    console.error(`✘ image smoke test: ${problems.join("\n")}`);
    return 1;
  }
  const image = imageName(
    read("backend/settings.gradle"),
    read("backend/build.gradle"),
  );
  const { name, command, args: commandArgs, cwd } = buildStep(image);
  if (!(await step(name, command, commandArgs, cwd))) return 1;
  const [spaWebConfig] = globSync(SPA_WEB_CONFIG, { cwd: root });
  if (!spaWebConfig) {
    console.error(`✘ image smoke test: no ${SPA_WEB_CONFIG}`);
    return 1;
  }
  const locales = builtLocales(read("frontend/angular.json"));
  const fallback = defaultLocale(read(spaWebConfig));
  const endpoint = appEndpoint(process.env.DOCKER_HOST);
  const names = plan({
    id: randomBytes(4).toString("hex"),
    image,
    postgres: postgresImage(read("compose.yaml")),
    publish: endpoint.publish,
  });
  const interrupted = () => {
    teardown(names);
    process.exit(130);
  };
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  try {
    docker(["network", "create", names.network], { quiet: true });
    docker(names.dbRun, { quiet: true });
    await smoke(names, `http://${endpoint.host}`, { locales, fallback });
    console.log(
      `✔ ${image} is healthy and serves ${locales.map((locale) => `/${locale}/`).join(", ")}`,
    );
    return 0;
  } catch (error) {
    console.error(`✘ image smoke test: ${error.message}`);
    // Empty when the app container never started.
    spawnSync("docker", ["logs", "--tail", "200", names.app], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    return 1;
  } finally {
    teardown(names);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.slice(2));
}
