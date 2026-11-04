---
name: java-conventions
description: >-
  Java idioms for backend/ (Java 25, Spring Boot 4, no Lombok): typed ids, sealed outcomes
  instead of exceptions, the ProblemDetail error contract, Spring Data JDBC persistence and
  JdbcClient SQL, money and time, named literals, comment and Javadoc budget, logging without
  secrets or PII, and which test kind proves what. Load BEFORE writing or refactoring any Java —
  class, record, port, service, adapter, event or test. Which package or module a class belongs in is
  `backend-architecture`'s.
---

# Java conventions

Invariant numbers cite the root `AGENTS.md`. Structure is `backend-architecture`'s; this is how
the code inside a class reads. Full worked example: the `catalog` sample, while it exists.

## Typed ids and records

Records for ids, commands, views, events and DTOs; an id wraps its raw value and validates in
the compact constructor:

```java
public record ProductId(UUID value) implements Identifier {
    public ProductId {
        Objects.requireNonNull(value, "value");
    }
}
```

Typed ids in every port and event signature; the wire DTO uses primitives (`String id`). A port
returns `Optional<T>`, never `null`; a nullable record component says so in `@param`.

## Expected failures are values

A use case returns a sealed outcome; the controller switches over it exhaustively. Exceptions
are for bugs and broken invariants (`IllegalStateException` from `Product.publish` when called
without `checkPublish()` passing).

```java
public sealed interface RetireOutcome {
    record Retired(ProductView product) implements RetireOutcome {}
    record NotFound() implements RetireOutcome {}
    record NotPublished() implements RetireOutcome {}
}

return switch (retireProduct.retire(new ProductId(id))) {
    case RetireOutcome.Retired retired -> ResponseEntity.ok(ProductResponse.from(retired.product()));
    case RetireOutcome.NotFound _ -> notFound(id);
    case RetireOutcome.NotPublished _ -> conflict("Product " + id + " is not published", NOT_PUBLISHED);
};
```

A pattern, catch parameter or lambda parameter the code never reads is `_`.

## Error contract

Every error body is an RFC 9457 `ProblemDetail`. Outcome rejections are built in the controller
(`ProblemDetail.forStatusAndDetail`; a conflict adds a stable `reason` property the frontend
branches on);
everything thrown goes through `ApiErrorHandler`
(`backend/adapters/src/main/java/io/scaffold/starter/web/ApiErrorHandler.java`), the one
`@RestControllerAdvice`. It keeps Spring's problem bodies for framework errors (validation,
`ResponseStatusException`) and turns anything else into a bare 500 that logs the exception and
never puts its message in the body. No `@ExceptionHandler` in a controller. A renamed `reason` is
a breaking API change; `detail` wording is not.

## Persistence (invariant #1)

Spring Data JDBC maps package-private row records in `adapter.out.persistence`, never the domain
(ADR-0003). A row is a record with `@Table`, a `UUID` `@Id` and `Money` as
`@Embedded.Nullable(prefix = "price_")`; the adapter maps row ↔ aggregate both ways and unwraps
typed ids itself, without registered converters. Ids are domain-assigned, so writes say which
they are; `CrudRepository.save` would treat every row as existing:

```java
@Override
public void save(Product product) {
    ProductRow row = toRow(product);
    if (rows.existsById(row.id())) {
        template.update(row);
    } else {
        template.insert(row);
    }
}
```

`template` is the `JdbcAggregateTemplate`; `rows` a package-private interface extending
`Repository` that declares only the reads it needs (`findById`, `findAll`, `existsById`), so no
`save` is on offer. `existsById` then `insert` is two statements: a concurrent first save of the
same id fails on the primary key, acceptable while ids are fresh UUIDs. No `@Version`, `Persistable` or `@DomainEvents`: events leave through
`DomainEventPublisher` in the service. An update deletes and re-inserts every `@MappedCollection`
child, whose table carries the back-reference column (`@MappedCollection(idColumn, keyColumn)`).

A statement the aggregate model cannot express is a `@Modifying @Query` on the repository
interface (`insert … on conflict do nothing`); one that fits neither (a report, a bulk statement)
uses `JdbcClient` in the same adapter. Hand-written SQL in either: a text block, named parameters
only — concatenate constants (`COLUMNS`), never input. With `JdbcClient`, pass the SQL type for a
nullable parameter and write instants as UTC offsets:

```java
.param("priceMinor", price.map(Money::amountMinor).orElse(null), Types.BIGINT)
.param("publishedAt", product.publishedAt().map(at -> at.atOffset(ZoneOffset.UTC)).orElse(null),
        Types.TIMESTAMP_WITH_TIMEZONE)
```

Rows rebuild aggregates through a factory that skips creation rules, named `rehydrate`
(`Product.rehydrate`); only `adapter.out` and `domain.model` may call it
(`onlyDrivenAdaptersRehydrate`).
Schema rules live in the migration too; a Java constant mirroring a `check` (`MAX_NAME_LENGTH`
↔ `char_length(name) between 1 and 120`) changes with it.

## Money and time (invariants #3, #4)

`Money` from `shared`: `long amountMinor` + `Currency`, arithmetic with `Math.addExact`; never
`double` or `BigDecimal` amounts. Inject the `Clock` bean and read `clock.instant()` in the
service; pass the instant into the aggregate (`product.publish(clock.instant())`) so the domain
needs no clock. Business dates use the injected `ZoneId` (`app.business-time-zone`); never
`ZoneId.systemDefault()`, `LocalDate.now()` or `LocalDateTime.now()`.

## Named literals

A literal with meaning is a `private static final` constant or an enum (`REASON`,
`NOT_PUBLISHED`, `ProductStatus`); an enum whose names the database `check` lists stays in
lockstep with the SQL.

## Comments and Javadoc

Keep a line only if a fresh reader would act differently because of it. Javadoc states the
contract — parameters that may be null, what is thrown, idempotence (`Appends one entry per
product; appending an id that is already logged is a no-op.`) — never history, diff narration
or a restatement of the signature. Inline comments: one line, rarely; default to none.

## Logging

SLF4J with `{}` placeholders, never string concatenation; an exception goes last
(`log.error("Unhandled exception", exception)`) so the stack trace is kept. Never log a
secret, token, password or personal data; neutralize `\r` and `\n` in user-supplied text before
logging it. Log an unexpected exception once, where it is handled (`ApiErrorHandler`), not at
every layer it passes.

## Which test proves what

| Behaviour | Test | Where |
|---|---|---|
| domain rule, use case | plain JUnit + AssertJ; `port.out` faked in memory, `Clock.fixed(...)` | `backend/application-core/src/test/java`, same package |
| controller mapping, validation, status codes | `@WebMvcTest(Controller.class)` + `@MockitoBean` per `port.in` | `bootstrap` tests, controller's package |
| SQL, constraints, round-trips | `@ApplicationModuleTest` + `@Import(TestcontainersConfiguration.class)` + `@Tag("container")` | `bootstrap` tests, adapter's package |
| event flow, rollback | `@ApplicationModuleTest` (a `Scenario` parameter needs nothing more), tagged `container` | `bootstrap` tests, area package |
| the whole app starts | `@SpringBootTest`, tagged `container` | `bootstrap` tests, base package |

A module test starts the area, `shared` and the wiring in the base package
(`areaTestsAreModuleTests` rejects `@SpringBootTest` in an area). Mock another area's `port.in`
with `@MockitoBean` instead of widening `mode`. `web` is a module of its own, so a test of the
generic error body adds `extraIncludes = "web"` to bring in `ApiErrorHandler`.

A fake must behave like the real adapter: `InMemoryProductRepository` stores and returns copies,
so an unsaved change is lost as it would be in the database. A test needing Docker carries
`@Tag("container")` so `--quick` and `-PexcludeTags=container` skip it.
