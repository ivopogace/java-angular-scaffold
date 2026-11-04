package io.scaffold.starter.catalog.adapter.out.persistence;

import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.application.port.out.ProductRepository.UpdateResult;
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
import org.springframework.jdbc.core.simple.JdbcClient.StatementSpec;
import org.springframework.stereotype.Repository;

@Repository
class JdbcProductRepository implements ProductRepository {

    private static final String COLUMNS = "id, name, price_minor, price_currency, status, published_at, version";

    private final JdbcClient jdbc;

    JdbcProductRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void addNew(Product product) {
        bindState(jdbc.sql("""
                        insert into catalog_product (id, name, price_minor, price_currency, status, published_at, version)
                        values (:id, :name, :priceMinor, :priceCurrency, :status, :publishedAt, :version)
                        """), product)
                .param("version", product.loadedVersion())
                .update();
    }

    @Override
    public UpdateResult updateIfUnchangedSinceLoad(Product product) {
        int updated = bindState(jdbc.sql("""
                        update catalog_product set
                            name = :name,
                            price_minor = :priceMinor,
                            price_currency = :priceCurrency,
                            status = :status,
                            published_at = :publishedAt,
                            version = version + 1
                        where id = :id and version = :loadedVersion
                        """), product)
                .param("loadedVersion", product.loadedVersion())
                .update();
        return updated == 1 ? UpdateResult.UPDATED : UpdateResult.CHANGED_SINCE_LOAD;
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

    private static StatementSpec bindState(StatementSpec statement, Product product) {
        Optional<Money> price = product.price();
        return statement
                .param("id", product.id().value())
                .param("name", product.name())
                .param("priceMinor", price.map(Money::amountMinor).orElse(null), Types.BIGINT)
                .param("priceCurrency", price.map(money -> money.currency().getCurrencyCode()).orElse(null), Types.CHAR)
                .param("status", product.status().name())
                .param("publishedAt",
                        product.publishedAt().map(at -> at.atOffset(ZoneOffset.UTC)).orElse(null),
                        Types.TIMESTAMP_WITH_TIMEZONE);
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
                publishedAt == null ? null : publishedAt.toInstant(),
                row.getLong("version"));
    }
}
