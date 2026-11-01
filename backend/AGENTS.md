# Backend

Gradle build (Kotlin DSL; versions in `gradle/libs.versions.toml`, conventions in `build-logic/`).
Run commands from here; the general list is in the root `AGENTS.md`. Decisions behind this layout:
`../docs/adr/`.

## Layers: Gradle modules, dependencies point inward

- `core/` — domain + application. Runtime classpath: JDK, jMolecules, `jakarta.transaction-api`,
  `spring-modulith-api` (annotation-only). Spring is not on `core`'s compile classpath, so a
  Spring import there does not compile; `checkCoreClasspath` fails the build if a dependency drags
  anything else onto the runtime classpath (invariant #5).
- `adapters/` — driving (`adapter/in/web`, `adapter/in/event`) and driven (`adapter/out/persistence`,
  `adapter/out/<gateway>`) adapters; depends on `core` and Spring. Flyway migrations live in
  `adapters/src/main/resources/db/migration/`.
- `bootstrap/` — `Application` (`@SpringBootApplication @Modulithic`), wiring that names no area
  (in the root package, next to `Application`), `application.properties`, and every architecture
  test (the only place all classes are visible).

## Business area packages

An area is a Spring Modulith module, package `io.scaffold.starter.<area>`, split across `core` and
`adapters`:

```
core:      <area>/package-info.java          @ApplicationModule(allowedDependencies = …)
           <area>/domain/model/              INTERNAL  aggregates, entities, value objects (jMolecules)
           <area>/domain/id/                 PUBLISHED typed ids other areas may hold (@NamedInterface)
           <area>/domain/event/              PUBLISHED domain events: records of ids + immutable facts
           <area>/application/port/in/       PUBLISHED use-case interfaces + command/result records
           <area>/application/port/out/      INTERNAL  driven ports (repositories of own aggregates)
           <area>/application/service/       INTERNAL  use-case implementations, @UseCase, package-private
           shared/                           kernel every area may use: @UseCase, Money,
                                             DomainEventPublisher; no logic, no area state
adapters:  <area>/adapter/in/web/            REST controllers + request/response DTOs + mapping
           <area>/adapter/in/event/          listeners on other areas' events → call port/in
           <area>/adapter/out/persistence/   JdbcClient adapters + row mapping
           <area>/adapter/out/<gateway>/     external systems, one package per system
           web/                              ApiErrorHandler, the one @RestControllerAdvice
```

The listed packages are the whole shape; no sub-packages beneath them.

## What may cross

- Another area imports only `port/in`, `domain/id` and `domain/event` (invariant #6) — never
  `domain/model`, `port/out`, `service` or adapters.
- `domain` imports the JDK, jMolecules, `shared`, its own sub-packages and other areas' `domain/id`
  (hold their typed ids, never a raw UUID). Only the `package-info.java` of `domain/id` and
  `domain/event` may import more (Modulith's `@NamedInterface`).
- `port/in` records use `domain/id`, `shared` and JDK types, never aggregates; services map
  aggregates to them — the one mapping inside `core`.
- An area's adapters use its `port/in`, `port/out` and `domain`, never `service`. Persistence maps
  aggregates to rows, web maps `port/in` records to DTOs; no domain type in a REST response.
- A value object several areas need goes to `shared`; one only an area needs stays in its
  `domain/model`.

## Spring-free core: the three replacements

| Concern | In `core` | Wired by |
|---|---|---|
| Beans | `@UseCase` on package-private services | `UseCaseConfiguration` scans for it |
| Transactions | `jakarta.transaction.Transactional` on use-case methods | Spring's transaction support |
| Domain events | `DomainEventPublisher` port | adapter over Spring's publisher → Modulith's JDBC event publication registry; listeners in `adapter/in/event` call `port/in` |

## Conventions

- Rich aggregates with jMolecules annotations (`@AggregateRoot`, `@Entity`, `@ValueObject`,
  `@Identity`); typed ids; `Money` from `shared` (invariant #3).
- Expected failures are sealed outcome types returned from use cases, not exceptions.
- Errors leave as RFC 9457 `ProblemDetail`: outcome rejections built in the controller,
  everything thrown through `ApiErrorHandler`.
- Time: inject the `Clock` bean; business dates use the `ZoneId` bean from `app.business-time-zone`
  (invariant #4).
- Migrations: infrastructure is `V1…`; project migrations continue after it; never edit an applied
  one (invariant #2).
- Tests: `core` — plain unit tests with in-memory fakes of `port/out`; web — slice tests;
  persistence and full-stack — Testcontainers ITs tagged `container` (`-PexcludeTags=container`
  skips them).

## The structural net

All in `bootstrap/src/test/java/`, passing with zero areas. Run after any change to packages,
dependencies or annotations:

```bash
./gradlew :core:checkCoreClasspath :bootstrap:test --tests "*ModularityTests*" \
  --tests "*ArchitectureTest*" --tests "*ArchitectureRulesNegativeTest*"
```

`ModularityTests` runs Modulith's `verify()` (what one area may see of another);
`ArchitectureTest` applies the project's structural rules (`ArchitectureRules`): the area package
shape; `domain` depends only on the JDK, jMolecules, `shared`, its own `domain` and other areas'
`domain/id`; `port/in` and `domain/event` never depend on `domain/model`; services are
package-private and `@UseCase` when they implement a `port/in` interface; adapters never use
`application/service`; no JPA anywhere; no Spring beyond `org.springframework.modulith`, and no
`java.sql`, in `core` — plus jMolecules' DDD and hexagonal rules;
`ArchitectureRulesNegativeTest` proves each rule fails on a violating fixture. A new rule gets a
negative fixture in the same change.
