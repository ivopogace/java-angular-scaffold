package io.scaffold.starter.catalog.domain.event;

import io.scaffold.starter.catalog.domain.id.ProductId;
import java.time.Instant;
import org.jmolecules.event.types.DomainEvent;

public record ProductPublished(ProductId productId, Instant publishedAt) implements DomainEvent {
}
