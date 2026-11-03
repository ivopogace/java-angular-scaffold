package io.scaffold.starter.catalog.application.port.out;

import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import java.util.List;
import java.util.Optional;

public interface ProductRepository {

    /** Inserts the product, or overwrites the stored one with the same id. */
    void save(Product product);

    Optional<Product> findById(ProductId id);

    List<Product> findAll();
}
