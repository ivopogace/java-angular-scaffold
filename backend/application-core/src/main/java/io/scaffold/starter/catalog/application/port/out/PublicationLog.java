package io.scaffold.starter.catalog.application.port.out;

import io.scaffold.starter.catalog.domain.id.ProductId;
import java.time.Instant;

public interface PublicationLog {

    /** Appends one entry per product; appending an id that is already logged is a no-op. */
    void append(ProductId id, Instant publishedAt);
}
