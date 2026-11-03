# Hexagonal layers as Gradle modules, business areas as Modulith modules

The backend is three Gradle modules with dependencies pointing inward — `application-core` (domain +
application), `adapters` (web, event listeners, persistence, gateways) and `bootstrap` (main class,
wiring, configuration) — and each business area is a Spring Modulith module whose package spans
`application-core` and `adapters`. Two independent boundaries mean a layer leak (domain code
reaching for JDBC) fails to compile and an area leak (one area using another's internals) fails
`ApplicationModules.verify()`, instead of either depending on review.

## Considered Options

- One Gradle module with layer packages checked by ArchUnit alone: a simpler build, but a forbidden
  import compiles and only a test notices.
- One Gradle module per business area: area boundaries become compile boundaries too, but every new
  area costs a build module, and published ids, events and ports need their own artifacts.

## Consequences

- An area's package is split across the `application-core` and `adapters` jars, which is fine on the
  classpath because the module system (JPMS) is not used. Modulith verification and the architecture
  tests therefore run from `bootstrap`'s tests, the one place every class is visible.
