# Production image with Cloud Native Buildpacks, smoke-tested in `verify`

The production container image is built by Spring Boot's own `bootBuildImage` task with the Paketo
`builder-noble-java-tiny` builder, not from a Dockerfile. `BP_JVM_VERSION` follows the Gradle
toolchain, so the image runs the JRE the code was compiled for; the buildpacks bring a layered
jar, a memory calculator that sizes the heap from the container limit, a non-root user and an
SBOM, and Paketo patches the base and JRE layers on its own cadence. The image name is
`rootProject.name:version`, which `init` rewrites. Building one fails unless every locale build of
the SPA was packaged (`checkSpaPackaged`), because an image without it starts and reports healthy
while serving no page. `scripts/smoke-image.mjs` builds the image, runs it against the Postgres of
`compose.yaml` on a throwaway network and checks health, the locale redirect and both builds; the
full `verify` runs it, so CI proves the image on every change (invariant #9), and `--quick` skips
it.

## Considered Options

- A Dockerfile (multi-stage, `eclipse-temurin:25-jre` base): every line visible and buildable with
  plain `docker build` or any CI image builder. Rejected: the JRE choice, layering, memory flags,
  user and base-image patching become ours to write and keep current, for an output the buildpacks
  already produce.
- Jib: no Docker daemon needed to build. Rejected: one more plugin to keep in step with Boot, and
  the smoke test needs a daemon anyway to run the image.
- Smoke test as a separate opt-in script outside `verify`. Rejected: nothing would then catch a
  change that breaks the image (a missing SPA, a config that only `bootRun` supplied) until a
  deploy, and the full `verify` already needs Docker and network for Testcontainers, npm audit and
  Playwright.

## Consequences

- The full `verify` takes longer: the first run pulls the builder and run images (several hundred
  MB from Docker Hub) and the JRE (from GitHub), later runs reuse Docker's cache. Docker Hub's pull
  rate limit or a proxy that the build container cannot see fails the step; `--quick` stays
  offline-capable.
- The image has no shell or package manager (`tiny`): debug through logs and Actuator, not
  `docker exec … sh`. A buildpack option is a `BP_*` entry in `bootBuildImage`'s `environment`,
  never a secret: everything deployment-specific comes from environment variables at runtime.
- A project that must build without a Docker daemon, or on a registry-only CI builder, has to
  replace both `bootBuildImage` and the smoke step's build.

Hosts that only build from a Dockerfile in the repository, such as Render, get one alongside this
image: `docs/adr/0007-dockerfile-for-source-builds.md`.
