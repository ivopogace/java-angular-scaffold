package io.scaffold.starter.catalog.domain.event;

import io.scaffold.starter.catalog.domain.id.ProductId;
import java.time.Instant;
import org.jmolecules.event.types.DomainEvent;

/** A product moved from draft to published at {@code publishedAt}. */
public record ProductPublished(ProductId productId, Instant publishedAt) implements DomainEvent {
}
