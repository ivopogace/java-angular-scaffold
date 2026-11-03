# Production image from the root Dockerfile, smoke-tested in `verify`

The production image is built from the multi-stage `Dockerfile` at the repository root, so it
builds with plain `docker build` on any host or CI builder, including hosts such as Render that
take only a Dockerfile, with no local JDK or frontend build first. A Node stage (the version of
`.nvmrc`) runs `npm ci` and `npm run build`; a JDK stage (the Java major of the Gradle toolchain)
runs `checkSpaPackaged` and `bootJar`, so the build fails unless every locale build of the SPA was
packaged (an image without it starts and reports healthy while serving no page), and extracts
Spring Boot's layers, dependencies before the application so they stay cached; an Eclipse
Temurin JRE stage runs them as a non-root user on `8080` with the heap at 75 % of the container's
memory (`-XX:MaxRAMPercentage=75`). Base images are pinned to exact tags that Renovate bumps; the
Node version and the Java major move by hand with `.nvmrc` and the toolchain. The Dockerfile names
no project (it copies `frontend/dist` whole and the jar by pattern), so `init` rewrites nothing in
it. `scripts/smoke-image.mjs` refuses to build when the base images disagree with `.nvmrc` or the
toolchain, then builds the image as `<project name>:<version>`, runs it against the Postgres of
`compose.yaml` on a throwaway network and checks health, the locale redirect and every locale
build; the full `verify` runs it, so CI proves the image on every change (invariant #9), and
`--quick` skips it.

## Considered Options

- Cloud Native Buildpacks (`bootBuildImage`): rejected, an opaque build with its own failure
  modes (builder pulls, a JRE downloaded inside the build container, proxies it cannot see) for a
  memory calculator, SBOM and shell-less base that a heap flag, a CI step and a base image cover.
- Jib: rejected, one more plugin to keep in step with Spring Boot, unusable by hosts that build
  only a Dockerfile, and the smoke test needs a Docker daemon anyway.

## Consequences

- The full `verify` repeats `npm ci`, the Angular build and the Gradle dependency download inside
  fresh containers (BuildKit cache mounts help a local daemon, not a fresh CI runner); Docker Hub's
  pull rate limit fails the step, and `--quick` stays offline-capable.
- The JRE, layering, heap flag, user and base-image updates are ours to keep current, through
  Renovate and the smoke test.
- The runtime base is the full Temurin JRE image, so it has a shell for `docker exec`; a project
  that wants a shell-less base swaps the last stage's `FROM` and the JRE check in
  `smoke-image.mjs`'s `checkDockerfilePins`.
- `JAVA_TOOL_OPTIONS` set at runtime replaces the heap setting, so a deployment that sets it
  repeats `-XX:MaxRAMPercentage=75`.
