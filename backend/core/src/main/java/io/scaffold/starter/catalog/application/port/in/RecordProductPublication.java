package io.scaffold.starter.catalog.application.port.in;

import io.scaffold.starter.catalog.domain.id.ProductId;
import java.time.Instant;

public interface RecordProductPublication {

    /** Records that the product was published; recording the same product again changes nothing. */
    void record(ProductId id, Instant publishedAt);
}
