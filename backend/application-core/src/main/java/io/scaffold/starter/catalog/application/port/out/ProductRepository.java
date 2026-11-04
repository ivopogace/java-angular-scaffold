package io.scaffold.starter.catalog.application.port.out;

import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import java.util.List;
import java.util.Optional;

/** Optimistic locking: an update succeeds only against the version the product was loaded with. */
public interface ProductRepository {

    /** Stores a product whose id is not stored yet, at its {@link Product#version()}. */
    void add(Product product);

    /**
     * Overwrites the stored product and increments its stored version, if that version still equals
     * {@link Product#version()}. The instance keeps the version it was loaded with, so update it at most once
     * per load.
     *
     * @return {@code false} if the stored version differs or the product is gone: a concurrent change, and
     *         nothing was written
     */
    boolean update(Product product);

    Optional<Product> findById(ProductId id);

    List<Product> findAll();
}
