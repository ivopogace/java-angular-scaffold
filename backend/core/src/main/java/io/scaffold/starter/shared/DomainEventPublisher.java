package io.scaffold.starter.shared;

import org.jmolecules.event.types.DomainEvent;

/**
 * Driven port through which use cases publish domain events. The bootstrap-side adapter hands
 * them to Spring's publisher so Spring Modulith's event publication registry persists them.
 */
public interface DomainEventPublisher {

    void publish(DomainEvent event);
}
