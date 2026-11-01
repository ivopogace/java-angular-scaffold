package io.scaffold.starter.catalog.domain.id;

import java.util.Objects;
import java.util.UUID;
import org.jmolecules.ddd.types.Identifier;

/** Typed identity of a {@code Product}; other areas hold this instead of a raw UUID. */
public record ProductId(UUID value) implements Identifier {

    public ProductId {
        Objects.requireNonNull(value, "value");
    }

    public static ProductId newId() {
        return new ProductId(UUID.randomUUID());
    }
}
