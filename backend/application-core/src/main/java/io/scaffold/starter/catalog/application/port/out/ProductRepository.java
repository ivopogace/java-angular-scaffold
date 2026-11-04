package io.scaffold.starter.catalog.application.port.out;

import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import java.util.List;
import java.util.Optional;

public interface ProductRepository {

    enum UpdateResult {
        UPDATED,
        CHANGED_SINCE_LOAD
    }

    void addNew(Product product);

    UpdateResult updateIfUnchangedSinceLoad(Product product);

    Optional<Product> findById(ProductId id);

    List<Product> findAll();
}
