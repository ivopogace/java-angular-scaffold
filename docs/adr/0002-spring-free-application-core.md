# No Spring in `application-core`

`application-core` depends only on the JDK, jMolecules and two annotation-only jars —
`jakarta.transaction-api`, and `spring-modulith-api` because `@ApplicationModule` and
`@NamedInterface` must sit on `application-core`'s own packages — so the domain and use cases stay
testable as plain Java with in-memory fakes. Spring's three jobs inside `application-core` get
framework-neutral replacements: services carry our `@UseCase` annotation and `bootstrap`
component-scans for it; use-case methods use `jakarta.transaction.Transactional`, which Spring's
transaction support honours; and domain events leave through a `DomainEventPublisher` port whose
adapter delegates to Spring's publisher, so Spring Modulith's JDBC event publication registry still
applies. The cost is a little wiring in `bootstrap`.

## Consequences

- A Spring import in `application-core` does not compile, `checkApplicationCoreClasspath` fails the
  build if a dependency drags Spring or JPA onto `application-core`'s runtime classpath, and an
  ArchUnit rule allows `org.springframework.modulith` and nothing else from Spring.
- A service without `@UseCase` is silently not a bean; the architecture tests require every
  service to be non-public and every one implementing a `port.in` interface to carry `@UseCase`.
