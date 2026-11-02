# A Dockerfile for hosts that build from source; buildpacks stay primary

Some hosts, Render among them, build a container from the repository themselves and take only a
Dockerfile: they cannot run `bootBuildImage`, and pushing a prebuilt image means a registry and a
CI deploy step the template does not have. So the repository gets a root `Dockerfile` next to the
buildpack image of ADR 0006, which stays the primary build. The Dockerfile builds what
`bootBuildImage` packages, from source and without the host's help: a Node stage (the version of
`.nvmrc`) runs `npm ci` and `npm run build`; a JDK 25 stage runs `checkSpaPackaged` and `bootJar`,
so an image without both locale builds fails here too, and extracts Spring Boot's layers; an
Eclipse Temurin 25 JRE stage runs them as a non-root user on `8080`, the heap at 75 % of the
container's memory. Base images are pinned to exact tags that Renovate bumps; the Node version and
the Java major move by hand with `.nvmrc` and the Gradle toolchain, and the smoke test refuses to
build when they differ. `scripts/smoke-image.mjs --builder dockerfile` smoke-tests this image the
way it tests the buildpack one, and the full `verify` runs both (invariant #9).

## Considered Options

- Replace buildpacks with the Dockerfile, one image path. Rejected: ADR 0006's reasons stand (the
  memory calculator, SBOM, a shell-less base Paketo patches), and the Dockerfile exists only for
  hosts that cannot do better.
- Smoke-test only the buildpack image and trust the Dockerfile. Rejected: the Dockerfile is the
  path a Render deploy takes, so a break in it (a moved dist path, a Node bump without the image)
  would first show as a failed deploy.
- Build the image in CI and push it to a registry Render pulls from. Rejected for the template: a
  registry, its credentials and a deploy step per project; a project that has them can drop the
  Dockerfile.

## Consequences

- The full `verify` builds two images. The Dockerfile build repeats `npm ci`, the Angular build
  and the Gradle dependency download inside fresh containers (BuildKit cache mounts help a local
  daemon, not a fresh CI runner), adding several minutes; `--quick` runs neither.
- Two images can drift in behaviour the smoke test does not check, such as heap sizing and the
  base OS. The buildpack image is the reference; a fix for one is checked against the other.
- The Dockerfile names no project: it copies `frontend/dist` whole and the jar by pattern, so
  `init` needs nothing rewritten in it.
