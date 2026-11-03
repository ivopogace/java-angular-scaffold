package io.scaffold.starter.catalog.application.service;

import io.scaffold.starter.shared.DomainEventPublisher;
import java.util.ArrayList;
import java.util.List;
import org.jmolecules.event.types.DomainEvent;

class RecordingEventPublisher implements DomainEventPublisher {

    private final List<DomainEvent> published = new ArrayList<>();

    @Override
    public void publish(DomainEvent event) {
        published.add(event);
    }

    List<DomainEvent> published() {
        return List.copyOf(published);
    }
}
