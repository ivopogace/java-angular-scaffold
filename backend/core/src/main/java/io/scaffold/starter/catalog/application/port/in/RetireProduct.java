package io.scaffold.starter.catalog.application.port.in;

import io.scaffold.starter.catalog.domain.id.ProductId;

public interface RetireProduct {

    RetireOutcome retire(ProductId id);
}
