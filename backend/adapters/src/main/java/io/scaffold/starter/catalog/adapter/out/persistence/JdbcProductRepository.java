package io.scaffold.starter.catalog.adapter.out.persistence;

import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import io.scaffold.starter.catalog.domain.model.ProductStatus;
import io.scaffold.starter.shared.Money;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jdbc.core.JdbcAggregateTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcProductRepository implements ProductRepository {

    private final ProductRows rows;
    private final JdbcAggregateTemplate template;

    JdbcProductRepository(ProductRows rows, JdbcAggregateTemplate template) {
        this.rows = rows;
        this.template = template;
    }

    @Override
    public void save(Product product) {
        ProductRow row = toRow(product);
        if (rows.existsById(row.id())) {
            template.update(row);
        } else {
            template.insert(row);
        }
    }

    @Override
    public Optional<Product> findById(ProductId id) {
        return rows.findById(id.value()).map(JdbcProductRepository::toProduct);
    }

    @Override
    public List<Product> findAll() {
        return rows.findAll().stream().map(JdbcProductRepository::toProduct).toList();
    }

    private static ProductRow toRow(Product product) {
        return new ProductRow(
                product.id().value(),
                product.name(),
                product.price()
                        .map(money -> new MoneyRow(money.amountMinor(), money.currency().getCurrencyCode()))
                        .orElse(null),
                product.status().name(),
                product.publishedAt().orElse(null));
    }

    private static Product toProduct(ProductRow row) {
        MoneyRow price = row.price();
        return Product.rehydrate(
                new ProductId(row.id()),
                row.name(),
                price == null ? null : Money.of(price.minor(), price.currency()),
                ProductStatus.valueOf(row.status()),
                row.publishedAt());
    }
}
