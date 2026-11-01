---
name: backend-architecture
description: >-
  Structure authority for backend/: the core / adapters / bootstrap Gradle layers, the package
  shape of a business area, what may cross between areas, the Spring-free replacements in core,
  and the structural net. Load BEFORE adding or moving a class, package, port, event, area or
  Gradle dependency under backend/, or when ModularityTests, ArchitectureTest or
  checkCoreClasspath fails — "add a business area", "where does this class go", "expose this to
  another area". How to write the code inside a class is `java-conventions`'; SQL and Flyway are
  `postgres`'.
---

# Backend architecture

The build is the authority on structure: Gradle decides what `core` can see, Spring Modulith
decides what one area can see of another, ArchUnit decides the package shape. When one of them
fails, read the message literally and fix the structure, never the test. The rule lists live in
`backend/AGENTS.md`; this skill is how to apply them.

Full worked example: the `catalog` sample, while it exists.

## Where a class goes

| It is… | Package (under `<base>.<area>`) | Gradle module |
|---|---|---|
| aggregate, entity, value object only this area needs | `domain.model` | `core` |
| typed id another area may hold | `domain.id` | `core` |
| fact other areas may react to | `domain.event` | `core` |
| use-case interface, its command / view records, sealed outcome | `application.port.in` | `core` |
| repository or gateway the use case drives | `application.port.out` | `core` |
| use-case implementation | `application.service` | `core` |
| controller, request / response DTO | `adapter.in.web` | `adapters` |
| listener on an event | `adapter.in.event` | `adapters` |
| `JdbcClient` adapter of a `port.out` repository | `adapter.out.persistence` | `adapters` |
| client of one external system | `adapter.out.<system>` | `adapters` |
| value object several areas need, `@UseCase`, `DomainEventPublisher` | `<base>.shared` | `core` |
| the one `@RestControllerAdvice` | `<base>.web` | `adapters` |
| wiring that names no area (`ClockConfiguration`, `UseCaseConfiguration`) | `<base>` next to `Application` | `bootstrap` |

The listed packages are exhaustive: `adapter.in.web.dto` or `domain.model.pricing` fails
`areaPackageShape` — flatten into the listed package. `shared` and `web` are not areas; wiring
sits in the root package, next to `Application`, so a `config` package would be judged as an area
and fail.

## Crossing between areas

- Another area needs an **answer now** → it calls a `port.in` interface. It needs to **react to a
  fact** → publish a `domain.event` and listen in its `adapter.in.event`, which calls its own
  `port.in`. Calling many use cases of one area is a coupling smell; prefer an event.
- Grant only what is used: `@ApplicationModule(allowedDependencies = {"shared", "<area>::port-in",
  "<area>::id"})`, naming the `@NamedInterface` values (`port-in`, `id`, `event`).
- Hold another area's entity by its `domain.id` type, never a raw `UUID`.
- Events are records of ids and immutable facts. Modulith's registry stores each publication in
  `event_publication` with the event's class name and the listener's id. A listener that fails
  leaves its publication incomplete; it is republished at the next startup
  (`spring.modulith.events.republish-outstanding-events-on-restart=true`), not retried in between.
  Delivery is at-least-once, so listeners are idempotent (`JdbcPublicationLog` appends with
  `on conflict do nothing`). Renaming or moving an event class or listener method is a data
  change: a forward migration rewriting outstanding `event_publication` rows, or
  `@ApplicationModuleListener(id = …)` fixed before it ships.

## Spring-free core

Spring is not on `core`'s compile classpath, so a Spring import there fails to compile.
`checkCoreClasspath` guards the runtime classpath (a dependency that drags in Spring beyond
`spring-modulith-api`, Hibernate or JPA), and `coreIsSpringFree` also rejects `java.sql` types.
The three replacements:

```java
@UseCase
class PublicationRecorder implements RecordProductPublication {
    @Override
    @Transactional                  // jakarta.transaction.Transactional
    public void record(ProductId id, Instant publishedAt) {
        log.append(id, publishedAt);
    }
}
```

- **Beans:** `UseCaseConfiguration` component-scans for `@UseCase` and nothing else in `core`.
  Every top-level class in `application.service` must be non-public; `@UseCase` is required on the ones that
  implement a `port.in` interface. A helper there without `@UseCase` is not a bean — construct it in
  the service, or annotate it too.
- **Transactions:** `jakarta.transaction.Transactional` on the use-case method; Spring's proxy
  honours it, so a call from inside the same class bypasses it. `PublishRollbackIT` proves a
  rollback; an area whose correctness depends on one keeps a test like it.
- **Events:** the service calls `DomainEventPublisher.publish(event)`;
  `DomainEventPublisherConfiguration` wires it as `publisher::publishEvent`, so the JDBC event
  publication registry persists it inside the use case's transaction.

## Adding a business area

1. `core/.../<area>/package-info.java`: `@ApplicationModule(allowedDependencies = "shared")`.
2. `domain.model`: the aggregate (`@AggregateRoot`, its id field `@Identity`), behaviour on it.
   `domain.id`: `record <Thing>Id(UUID value) implements Identifier`; `package-info` carries
   `@NamedInterface("id")`. `domain.event`: records implementing `DomainEvent`,
   `@NamedInterface("event")`.
3. `application.port.in` (`@NamedInterface("port-in")` + `@PrimaryPort` on the package),
   `application.port.out` (`@SecondaryPort`), `application.service` (package-private `@UseCase`).
4. Adapters: `adapter.in.*` packages carry `@PrimaryAdapter`, `adapter.out.*` `@SecondaryAdapter`;
   jMolecules' hexagonal rule checks only annotated packages. Adapter classes are package-private
   (`adaptersArePackagePrivate`).
5. One forward migration in `backend/adapters/src/main/resources/db/migration/` (invariant #2).
6. Tests: `core` unit tests sit in the service's package with in-memory `port.out` fakes; web
   slices and ITs go in `bootstrap`'s test sources in the package of the class under test.
7. A row in the root `AGENTS.md` *Business areas* table; terms in `GLOSSARY.md`
   (`domain-modeling`); the frontend feature folder (`frontend-architecture`).
8. Run the structural-net command from `backend/AGENTS.md`.

## The structural net

`ModularityTests`, `ArchitectureTest` and `ArchitectureRulesNegativeTest` in
`backend/bootstrap/src/test/java/io/scaffold/starter/`, plus `checkCoreClasspath`. Every rule
passes with zero areas (`allowEmptyShould(true)`). A new rule goes into `ArchitectureRules.all()`,
gets a mis-shaped fixture under `backend/bootstrap/src/test/java/archfixture/` and a row in
`violations()`, and bumps the rule count in `noRuleReportsTheCleanArea` — a rule no fixture
breaks proves nothing.

## Common mistakes

| Mistake | Fix |
|---|---|
| Public service, or `@Component` in `core` | package-private `@UseCase` |
| Aggregate in a `port.in` record or event (`publishedSurfaceIsAggregateFree` fails), or in a REST response | map to a view record in the service, to a DTO in the controller |
| Adapter imports `application.service` | inject the `port.in` interface |
| Sub-package such as `adapter.in.web.dto` | flatten into the listed package |
| Raising `allowedDependencies` to make `verify()` pass | publish the needed type through `port.in`, `domain.id` or `domain.event` |
