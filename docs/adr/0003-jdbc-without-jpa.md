# JDBC through `JdbcClient`, no JPA

Persistence adapters use Spring's `JdbcClient` with hand-written SQL and explicit row mapping; JPA and
Hibernate are on no classpath. The domain model is already mapped by hand at the persistence edge
(ADR-0004), so an ORM would add a second object model with lazy loading, flush ordering and dirty
checking without saving that work, while plain SQL keeps locking, upserts and constraint behaviour
visible in the adapter.

## Considered Options

- Spring Data JPA: less code for plain CRUD, but its entities would either be the domain (framework
  annotations in `application-core`, against ADR-0002) or a second mapped model on top of the
  mapping we write anyway.
- Spring Data JDBC: lighter than JPA, but its aggregate conventions want to own the table layout,
  and its repositories are still an abstraction to work around once queries get specific.

## Consequences

- Every query is written by hand and covered by a Testcontainers test against real PostgreSQL. An
  ArchUnit rule fails the build on any `jakarta.persistence` use.
