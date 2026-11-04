# Spring Data JDBC behind two-way mapping, no JPA

Persistence adapters use Spring Data JDBC to map package-private row records (`@Table`, `@Id`,
`@Embedded.Nullable` for `Money`) in `<area>/adapter/out/persistence/`, and map those rows to and
from the domain by hand (ADR-0004); JPA and Hibernate are on no classpath. Spring Data writes the
routine INSERT, UPDATE and SELECT by id, while the domain stays framework-free (ADR-0002) and the
schema keeps its own shape.

## Considered Options

- Plain `JdbcClient` only (the previous decision): no abstraction beyond Spring's JDBC template,
  with locking and constraint behaviour visible in the adapter, but every INSERT and SELECT is
  written by hand and child collections are managed manually.
- Spring Data JPA: less code for plain CRUD, but its entities would either be the domain (framework
  annotations in `application-core`, against ADR-0002) or a second mapped model with lazy loading,
  flush ordering and dirty checking on top of the mapping we write anyway.
- Spring Data JDBC with the domain itself as the entity, via jMolecules' ByteBuddy integration:
  no row records and no mapper, but it ties the schema to the domain's shape, so neither can change
  without the other, against ADR-0004.

## Consequences

- The domain assigns ids, so Spring Data cannot tell a new aggregate from a stored one. Adapters
  write through `JdbcAggregateTemplate.insert` or `.update` explicitly (`existsById` decides for an
  upsert-style port), never `CrudRepository.save`; there is no `@Version` and no `Persistable`.
  Reads go through package-private `ListCrudRepository` interfaces. Typed ids are unwrapped to
  `UUID` by the mapper, not by registered converters.
- On every update Spring Data JDBC deletes and re-inserts an aggregate's `@MappedCollection`
  children, and wants each child table to carry a back-reference column
  (`@MappedCollection(idColumn, keyColumn)` names it).
- `@DomainEvents` stays unused because the rows are not the domain; services keep publishing
  through `DomainEventPublisher`.
- A statement that does not fit the aggregate model (`insert … on conflict do nothing`) is a
  `@Modifying @Query` on the repository interface; a query that fits neither (a report, a bulk
  statement) uses `JdbcClient` in the same adapter.
- ArchUnit rules fail the build on JPA, Hibernate or Spring Data JPA anywhere and on Spring Data
  outside `adapter.out.persistence`. Every adapter is covered by a Testcontainers test against
  real PostgreSQL.
