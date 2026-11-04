package io.scaffold.starter.catalog.adapter.out.persistence;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Embedded;
import org.springframework.data.relational.core.mapping.Table;

/**
 * @param price {@code null} while the product is unpriced
 * @param status a {@code ProductStatus} name
 * @param publishedAt {@code null} until published
 */
@Table("catalog_product")
record ProductRow(
        @Id UUID id,
        String name,
        @Embedded.Nullable(prefix = "price_") MoneyRow price,
        String status,
        Instant publishedAt) {}
