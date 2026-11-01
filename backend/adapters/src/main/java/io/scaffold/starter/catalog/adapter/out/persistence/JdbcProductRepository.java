package io.scaffold.starter.catalog.adapter.out.persistence;

import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import io.scaffold.starter.catalog.domain.model.ProductStatus;
import io.scaffold.starter.shared.Money;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class JdbcProductRepository implements ProductRepository {

    private static final String COLUMNS = "id, name, price_minor, price_currency, status, published_at";

    private final JdbcClient jdbc;

    JdbcProductRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void save(Product product) {
        Optional<Money> price = product.price();
        jdbc.sql("""
                        insert into catalog_product (id, name, price_minor, price_currency, status, published_at)
                        values (:id, :name, :priceMinor, :priceCurrency, :status, :publishedAt)
                        on conflict (id) do update set
                            name = excluded.name,
                            price_minor = excluded.price_minor,
                            price_currency = excluded.price_currency,
                            status = excluded.status,
                            published_at = excluded.published_at
                        """)
                .param("id", product.id().value())
                .param("name", product.name())
                .param("priceMinor", price.map(Money::amountMinor).orElse(null), Types.BIGINT)
                .param("priceCurrency", price.map(money -> money.currency().getCurrencyCode()).orElse(null), Types.CHAR)
                .param("status", product.status().name())
                .param("publishedAt",
                        product.publishedAt().map(at -> at.atOffset(ZoneOffset.UTC)).orElse(null),
                        Types.TIMESTAMP_WITH_TIMEZONE)
                .update();
    }

    @Override
    public Optional<Product> findById(ProductId id) {
        return jdbc.sql("select " + COLUMNS + " from catalog_product where id = :id")
                .param("id", id.value())
                .query(JdbcProductRepository::toProduct)
                .optional();
    }

    @Override
    public List<Product> findAll() {
        return jdbc.sql("select " + COLUMNS + " from catalog_product")
                .query(JdbcProductRepository::toProduct)
                .list();
    }

    private static Product toProduct(ResultSet row, int rowNumber) throws SQLException {
        long priceMinor = row.getLong("price_minor");
        Money price = row.wasNull() ? null : Money.of(priceMinor, row.getString("price_currency"));
        OffsetDateTime publishedAt = row.getObject("published_at", OffsetDateTime.class);
        return Product.rehydrate(
                new ProductId(row.getObject("id", UUID.class)),
                row.getString("name"),
                price,
                ProductStatus.valueOf(row.getString("status")),
                publishedAt == null ? null : publishedAt.toInstant());
    }
}
