package io.scaffold.starter.catalog.adapter.out.persistence;

import static io.scaffold.starter.catalog.adapter.out.persistence.jooq.Tables.CATALOG_PRODUCT;
import static org.jooq.impl.DSL.excluded;

import io.scaffold.starter.catalog.adapter.out.persistence.jooq.CatalogProductRecord;
import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import io.scaffold.starter.catalog.domain.model.ProductStatus;
import io.scaffold.starter.shared.Money;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
class JooqProductRepository implements ProductRepository {

    private final DSLContext dsl;

    JooqProductRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    @Override
    public void save(Product product) {
        Optional<Money> price = product.price();
        dsl.insertInto(CATALOG_PRODUCT)
                .set(CATALOG_PRODUCT.ID, product.id().value())
                .set(CATALOG_PRODUCT.NAME, product.name())
                .set(CATALOG_PRODUCT.PRICE_MINOR, price.map(Money::amountMinor).orElse(null))
                .set(CATALOG_PRODUCT.PRICE_CURRENCY, price.map(money -> money.currency().getCurrencyCode()).orElse(null))
                .set(CATALOG_PRODUCT.STATUS, product.status().name())
                .set(CATALOG_PRODUCT.PUBLISHED_AT, product.publishedAt().orElse(null))
                .onConflict(CATALOG_PRODUCT.ID)
                .doUpdate()
                .set(CATALOG_PRODUCT.NAME, excluded(CATALOG_PRODUCT.NAME))
                .set(CATALOG_PRODUCT.PRICE_MINOR, excluded(CATALOG_PRODUCT.PRICE_MINOR))
                .set(CATALOG_PRODUCT.PRICE_CURRENCY, excluded(CATALOG_PRODUCT.PRICE_CURRENCY))
                .set(CATALOG_PRODUCT.STATUS, excluded(CATALOG_PRODUCT.STATUS))
                .set(CATALOG_PRODUCT.PUBLISHED_AT, excluded(CATALOG_PRODUCT.PUBLISHED_AT))
                .execute();
    }

    @Override
    public Optional<Product> findById(ProductId id) {
        return dsl.selectFrom(CATALOG_PRODUCT)
                .where(CATALOG_PRODUCT.ID.eq(id.value()))
                .fetchOptional(JooqProductRepository::toProduct);
    }

    @Override
    public List<Product> findAll() {
        return dsl.selectFrom(CATALOG_PRODUCT).fetch(JooqProductRepository::toProduct);
    }

    private static Product toProduct(CatalogProductRecord row) {
        Money price = row.getPriceMinor() == null ? null : Money.of(row.getPriceMinor(), row.getPriceCurrency());
        return Product.rehydrate(
                new ProductId(row.getId()),
                row.getName(),
                price,
                ProductStatus.valueOf(row.getStatus()),
                row.getPublishedAt());
    }
}
