# jOOQ for persistence, generated per business area

Persistence adapters query through jOOQ's DSL over classes generated from the Flyway migrations;
JPA, Hibernate and Spring Data are not used. Plain SQL — Spring's `JdbcClient` / `JdbcTemplate` or
jOOQ's `@PlainSQL` API — is the escape hatch for PostgreSQL features jOOQ does not model (full-text
search's `@@`), allowed only in an area's `adapter.out.persistence`. Generated classes turn a
renamed or dropped column into a compile error in every query that uses it, and the typed DSL keeps
dynamic filters, joins and read models safe as areas grow, while the SQL stays visible: locking,
upserts and constraint behaviour are written out in the adapter. The domain is still mapped by hand
at the persistence edge (ADR-0004): jOOQ records are the adapter's model, never the domain's.

## Considered Options

- `JdbcClient` with hand-written SQL: no code generation, but a query is checked only when a test
  runs it, and dynamic queries are assembled from strings.
- Spring Data JPA: its entities would either be the domain (framework annotations in
  `application-core`, against ADR-0002) or a second mapped model with lazy loading, flush ordering
  and dirty checking on top of the mapping we write anyway.
- Spring Data JDBC: lighter than JPA, but an aggregate with an assigned id or an embedded value
  needs Spring types or annotations (`Persistable`, `@Embedded`) or a mapped copy, and its aggregate
  conventions want to own the table layout.
- Generating from the migration files without a database (jOOQ's `DDLDatabase`): no Docker, but its
  parser drifts from real PostgreSQL once migrations use functions, triggers or extensions.

## Consequences

- `./gradlew :adapters:generateJooq` migrates a throwaway PostgreSQL (the image `compose.yaml`
  runs, as the Testcontainers ITs do; a Postgres-compatible image such as pgvector works) and
  writes `backend/adapters/src/generated/jooq/`. The output is committed, so compiling needs no
  Docker; `checkJooqGenerated`, part of `check` unless `-PexcludeTags=container`, fails
  when it no longer matches the migrations. A migration and its regenerated classes ship together.
- Tables are named `<area>_<name>` and generate into `<base>.<area>.adapter.out.persistence.jooq`,
  so Spring Modulith keeps an area's tables internal to it. A table of no area fails generation,
  unless it is Flyway's history or listed in `infrastructureTables` in `backend/adapters/build.gradle`
  (Spring Modulith's `event_publication`). `timestamptz` columns generate as `Instant`.
- ArchUnit rules fail the build on JPA, Hibernate or Spring Data anywhere, on `JdbcClient`,
  `JdbcTemplate` or a jOOQ plain-SQL string outside an area's `adapter.out.persistence` (tests
  included), and on a driving adapter touching the generated classes. Escape-hatch SQL is checked
  only when a test runs it, so each use states why and has an IT.
- jOOQ's open-source edition covers PostgreSQL; another database may need a commercial edition.
