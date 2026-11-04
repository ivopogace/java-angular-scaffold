package io.scaffold.starter.catalog.application.service;

import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

class InMemoryProductRepository implements ProductRepository {

    private final Map<ProductId, Product> storedCopies = new LinkedHashMap<>();

    @Override
    public void addNew(Product product) {
        if (storedCopies.putIfAbsent(product.id(), copyAt(product, product.loadedVersion())) != null) {
            throw new IllegalStateException("Product " + product.id().value() + " is already stored");
        }
    }

    @Override
    public UpdateResult updateIfUnchangedSinceLoad(Product product) {
        Product current = storedCopies.get(product.id());
        if (current == null || current.loadedVersion() != product.loadedVersion()) {
            return UpdateResult.CHANGED_SINCE_LOAD;
        }
        storedCopies.put(product.id(), copyAt(product, product.loadedVersion() + 1));
        return UpdateResult.UPDATED;
    }

    @Override
    public Optional<Product> findById(ProductId id) {
        return Optional.ofNullable(storedCopies.get(id)).map(InMemoryProductRepository::copyOf);
    }

    @Override
    public List<Product> findAll() {
        return storedCopies.values().stream().map(InMemoryProductRepository::copyOf).toList();
    }

    private static Product copyOf(Product product) {
        return copyAt(product, product.loadedVersion());
    }

    private static Product copyAt(Product product, long storedVersion) {
        return Product.rehydrate(
                product.id(),
                product.name(),
                product.price().orElse(null),
                product.status(),
                product.publishedAt().orElse(null),
                storedVersion);
    }
}
