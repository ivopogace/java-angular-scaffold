package io.scaffold.starter.catalog.application.port.in;

import io.scaffold.starter.catalog.domain.id.ProductId;
import java.util.Optional;

public interface FindProduct {

    Optional<ProductView> find(ProductId id);
}
