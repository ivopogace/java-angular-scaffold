package io.scaffold.starter.catalog.application.port.in;

import io.scaffold.starter.catalog.domain.id.ProductId;

public interface PublishProduct {

    PublishOutcome publish(ProductId id);
}
