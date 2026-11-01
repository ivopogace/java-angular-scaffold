package io.scaffold.starter.catalog.application.service;

import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Stores and returns copies, so a change only persists through {@link #save}, as with a database. */
class InMemoryProductRepository implements ProductRepository {

    private final Map<ProductId, Product> stored = new LinkedHashMap<>();

    @Override
    public void save(Product product) {
        stored.put(product.id(), copyOf(product));
    }

    @Override
    public Optional<Product> findById(ProductId id) {
        return Optional.ofNullable(stored.get(id)).map(InMemoryProductRepository::copyOf);
    }

    @Override
    public List<Product> findAll() {
        return stored.values().stream().map(InMemoryProductRepository::copyOf).toList();
    }

    private static Product copyOf(Product product) {
        return Product.rehydrate(
                product.id(),
                product.name(),
                product.price().orElse(null),
                product.status(),
                product.publishedAt().orElse(null));
    }
}
