package io.scaffold.starter.catalog.application.service;

import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

class InMemoryProductRepository implements ProductRepository {

    private final Map<ProductId, Product> stored = new LinkedHashMap<>();

    @Override
    public void save(Product product) {
        stored.put(product.id(), product);
    }

    @Override
    public Optional<Product> findById(ProductId id) {
        return Optional.ofNullable(stored.get(id));
    }

    @Override
    public List<Product> findAll() {
        return List.copyOf(stored.values());
    }
}
