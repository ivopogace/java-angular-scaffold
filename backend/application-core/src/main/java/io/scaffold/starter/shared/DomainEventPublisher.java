package io.scaffold.starter.shared;

import org.jmolecules.event.types.DomainEvent;

/** Bootstrap hands the events to Spring, so Spring Modulith's publication registry persists them. */
public interface DomainEventPublisher {

    void publish(DomainEvent event);
}
