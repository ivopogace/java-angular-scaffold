package io.scaffold.starter.catalog.application.service;

import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Stores and returns copies, so a change only persists through {@link #add} or {@link #update}, and checks the
 * version on update, as the database does.
 */
class InMemoryProductRepository implements ProductRepository {

    private final Map<ProductId, Product> stored = new LinkedHashMap<>();

    @Override
    public void add(Product product) {
        if (stored.putIfAbsent(product.id(), copyOf(product, product.version())) != null) {
            throw new IllegalStateException("Product " + product.id().value() + " is already stored");
        }
    }

    @Override
    public boolean update(Product product) {
        Product current = stored.get(product.id());
        if (current == null || current.version() != product.version()) {
            return false;
        }
        stored.put(product.id(), copyOf(product, product.version() + 1));
        return true;
    }

    @Override
    public Optional<Product> findById(ProductId id) {
        return Optional.ofNullable(stored.get(id)).map(product -> copyOf(product, product.version()));
    }

    @Override
    public List<Product> findAll() {
        return stored.values().stream().map(product -> copyOf(product, product.version())).toList();
    }

    private static Product copyOf(Product product, long version) {
        return Product.rehydrate(
                product.id(),
                product.name(),
                product.price().orElse(null),
                product.status(),
                product.publishedAt().orElse(null),
                version);
    }
}
