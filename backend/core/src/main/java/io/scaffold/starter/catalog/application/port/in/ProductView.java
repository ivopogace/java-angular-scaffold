package io.scaffold.starter.catalog.application.port.in;

import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.shared.Money;
import java.time.Instant;

/**
 * Read-only snapshot of a product.
 *
 * @param price null while no price is set
 * @param publishedAt null until the product is published
 */
public record ProductView(ProductId id, String name, Money price, ProductState state, Instant publishedAt) {
}
