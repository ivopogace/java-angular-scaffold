# Backend

Run commands from here; the list is in the root `AGENTS.md`.

## Layers: Gradle modules, dependencies point inward

- `application-core/` — domain + application. Runtime classpath: JDK, jMolecules,
  `jakarta.transaction-api`, `spring-modulith-api` (annotation-only). Spring is not on
  `application-core`'s compile classpath, so a Spring import there does not compile;
  `checkApplicationCoreClasspath` fails the build if a dependency drags anything else onto the
  runtime classpath (invariant #5).
- `adapters/` — driving (`adapter/in/web`, `adapter/in/event`) and driven
  (`adapter/out/persistence`, `adapter/out/<gateway>`) adapters; depends on `application-core` and
  Spring. Flyway migrations live in `adapters/src/main/resources/db/migration/`; the jOOQ classes
  generated from them are committed under `src/generated/jooq` (`generateJooq` in
  `adapters/build.gradle`) and never edited by hand.
- `bootstrap/` — `Application` (`@SpringBootApplication @Modulithic`), wiring that names no area
  (in the root package, next to `Application`), `application.properties`, and every architecture
  test (the only place all classes are visible).

## Business area packages

An area is a Spring Modulith module, package `io.scaffold.starter.<area>`, split across
`application-core` and `adapters`:

```
application-core:
           <area>/package-info.java          @ApplicationModule(allowedDependencies = …)
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
           <area>/adapter/out/persistence/   jOOQ adapters + record mapping
           <area>/adapter/out/persistence/jooq/  GENERATED jOOQ classes of the area's tables
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
  aggregates to them — the one mapping inside `application-core`. `port/in` and `domain/event` types
  carry data, not behaviour: interfaces without default methods, records and enums with only
  accessors, `equals` / `hashCode` / `toString` and static factories returning their own type.
- An area's adapters never use `service`. Driving adapters (`adapter/in`) go through `port/in`:
  never `domain/model` or `port/out`, so no aggregate reaches a REST response. Driven adapters
  (`adapter/out`) implement `port/out` and map aggregates to jOOQ records; only they and
  `domain/model` call an aggregate's `rehydrate` factory, which skips the creation rules. Driving
  adapters never use the generated `persistence/jooq` classes.
- A value object several areas need goes to `shared`; one only an area needs stays in its
  `domain/model`.

## Migrations

Infrastructure is `V1…`; project migrations continue after it; never edit an applied one
(invariant #2). An area's tables, views and materialized, partitioned or foreign tables are named
`<area>_<name>` (a name matching two areas belongs to the longer), or `generateJooq` fails; a
table of no area (ShedLock, Modulith's `event_publication_archive`) goes into
`infrastructureTables` in `adapters/build.gradle` in the same change. `generateJooq` and the
Testcontainers ITs run the image of `compose.yaml`'s `postgres` service; a Postgres-compatible one
(`pgvector/pgvector:pg18`) works. After a migration, run `./gradlew :adapters:generateJooq` and
commit its output with it; `checkJooqGenerated` (part of `build`, skipped by
`-PexcludeTags=container`) fails otherwise.

## The structural net

All in `bootstrap/src/test/java/`, passing with zero areas. Run after any change to packages,
dependencies or annotations:

```bash
./gradlew :application-core:checkApplicationCoreClasspath \
  :bootstrap:test --tests "*ModularityTests*" --tests "*ArchitectureTest*" \
  --tests "*ArchitectureRulesNegativeTest*"
```

`ModularityTests` checks what one area may see of another. `ArchitectureTest` applies
`ArchitectureRules`: the package shape; `domain`'s imports; `port/in` and `domain/event` free of
`domain/model` and data-only; adapters never using `service`; `adapter/in` never using
`domain/model`, `port/out` or the generated jOOQ classes; who may call `rehydrate`;
package-private services (`@UseCase` when they implement `port/in`), adapter classes (generated
jOOQ classes aside) and `web`; persistence only through jOOQ (no JPA, Hibernate or Spring Data;
JDBC (`java.sql`, `javax.sql`, Spring's `JdbcClient` and the like) and jOOQ plain-SQL strings,
called or method-referenced, only in an area's `adapter/out/persistence`,
the escape hatch for SQL jOOQ does not model, which also holds over the tests); no
Spring beyond Modulith
and no `java.sql` / `javax.sql` in `application-core`; and, over the tests, area tests are
`@ApplicationModuleTest`, never `@SpringBootTest`. It also applies jMolecules' DDD and hexagonal
rules. No rule checks
the raw-UUID, `adapter/out`-implements-`port/out` or `shared`-value-object points, and the `domain`
import rule skips every `package-info.java`, not only those of `domain/id` and `domain/event`;
review catches those. `ArchitectureRulesNegativeTest` proves each rule fails on a violating
fixture; a new rule gets one in the same change.
