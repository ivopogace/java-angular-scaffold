# Rich domain model, mapped at every edge

Aggregates and entities carry their own behaviour and invariants (annotated with jMolecules), value
objects carry typed ids and money, and the persistence and web adapters each map to their own
classes, so no domain type appears in a REST response or a generated jOOQ record. We pay for
two-way mapping because it lets the domain change shape without breaking the API or the schema and
keeps it framework-free (ADR-0002).

## Considered Options

- Transaction Script (state in tables, transitions as conditional UPDATEs): far less mapping, but
  the invariants spread across SQL and services, and the domain cannot be tested without a database.

## Consequences

- Other areas see an area only through `application/port/in` (use-case interfaces whose command and
  result records use typed ids, `shared` and JDK types, never aggregates), `domain/id` and
  `domain/event`. `domain/model`, `port/out`, `service` and the adapters stay internal. Services map
  aggregates to `port/in` records, the one mapping inside `application-core`.
- Ids and events are domain concepts, so they live under `domain`; they get their own sub-packages
  only because Spring Modulith publishes or hides whole packages (`@NamedInterface` on their
  `package-info.java`), which leaves `domain/model` the one hidden domain package. A domain class may
  hold another area's typed id, never a raw UUID for it.
- A value object several areas need lives in the `shared` kernel; one only an area needs stays in its
  `domain/model`.
