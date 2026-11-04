package io.scaffold.starter.catalog.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import io.scaffold.starter.TestcontainersConfiguration;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import io.scaffold.starter.catalog.domain.model.ProductStatus;
import io.scaffold.starter.shared.Money;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.TimeZone;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.test.ApplicationModuleTest;

@ApplicationModuleTest
@Import(TestcontainersConfiguration.class)
@Tag("container")
class JdbcProductRepositoryIT {

    @Autowired
    JdbcProductRepository products;

    @Autowired
    JdbcPublicationLog publicationLog;

    @Autowired
    JdbcClient jdbc;

    @Test
    void roundTripsAPricedPublishedProduct() {
        Instant publishedAt = Instant.parse("2026-11-01T10:15:30.123456Z");
        Product saved = Product.rehydrate(
                ProductId.newId(), "Linen shirt", Money.of(4999, "EUR"), ProductStatus.PUBLISHED, publishedAt);

        products.save(saved);

        Product loaded = products.findById(saved.id()).orElseThrow();
        assertThat(loaded.id()).isEqualTo(saved.id());
        assertThat(loaded.name()).isEqualTo("Linen shirt");
        assertThat(loaded.price()).contains(Money.of(4999, "EUR"));
        assertThat(loaded.status()).isEqualTo(ProductStatus.PUBLISHED);
        assertThat(loaded.publishedAt()).contains(publishedAt);
    }

    @Test
    void roundTripsAnUnpricedDraft() {
        Product draft = Product.draft(ProductId.newId(), "Mystery box", null);

        products.save(draft);

        Product loaded = products.findById(draft.id()).orElseThrow();
        assertThat(loaded.price()).isEmpty();
        assertThat(loaded.publishedAt()).isEmpty();
        assertThat(loaded.status()).isEqualTo(ProductStatus.DRAFT);
    }

    @Test
    void savingTwiceUpdatesInsteadOfInserting() {
        Product product = Product.draft(ProductId.newId(), "Candle", Money.of(1200, "EUR"));
        products.save(product);
        product.publish(Instant.parse("2026-11-01T08:00:00Z"));

        products.save(product);

        assertThat(rowCount(product.id())).isEqualTo(1);
        assertThat(products.findById(product.id()).orElseThrow().status()).isEqualTo(ProductStatus.PUBLISHED);
    }

    @Test
    void savingAnExistingIdOverwritesEveryColumn() {
        ProductId id = ProductId.newId();
        products.save(Product.rehydrate(
                id, "Old name", Money.of(500, "EUR"), ProductStatus.PUBLISHED, Instant.parse("2026-11-01T07:00:00Z")));

        products.save(Product.rehydrate(id, "New name", null, ProductStatus.DRAFT, null));

        Product loaded = products.findById(id).orElseThrow();
        assertThat(rowCount(id)).isEqualTo(1);
        assertThat(loaded.name()).isEqualTo("New name");
        assertThat(loaded.price()).isEmpty();
        assertThat(loaded.status()).isEqualTo(ProductStatus.DRAFT);
        assertThat(loaded.publishedAt()).isEmpty();
    }

    @Test
    void instantsRoundTripWhenTheJvmDefaultZoneIsNotUtc() {
        // 01:30 local time happens twice in New York on this date; only the instant tells them apart.
        Instant publishedAt = Instant.parse("2026-11-01T05:30:00.123456Z");
        TimeZone original = TimeZone.getDefault();
        TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"));
        try {
            Product product = Product.rehydrate(
                    ProductId.newId(), "Lamp", Money.of(2500, "USD"), ProductStatus.PUBLISHED, publishedAt);
            products.save(product);
            publicationLog.append(product.id(), publishedAt);

            assertThat(products.findById(product.id()).orElseThrow().publishedAt()).contains(publishedAt);
            assertThat(storedInstant("catalog_product", "id", product.id())).isEqualTo(publishedAt);
            assertThat(storedInstant("catalog_publication_log", "product_id", product.id())).isEqualTo(publishedAt);
        } finally {
            TimeZone.setDefault(original);
        }
    }

    @Test
    void findByIdOfAnUnknownIdIsEmpty() {
        assertThat(products.findById(ProductId.newId())).isEmpty();
    }

    @Test
    void findAllReturnsEveryStoredProduct() {
        Product first = Product.draft(ProductId.newId(), "First", null);
        Product second = Product.draft(ProductId.newId(), "Second", Money.of(100, "ALL"));
        products.save(first);
        products.save(second);

        assertThat(products.findAll()).extracting(Product::id).contains(first.id(), second.id());
    }

    @Test
    void appendingALoggedIdAgainIsANoOp() {
        Product product = Product.draft(ProductId.newId(), "Mug", Money.of(800, "EUR"));
        products.save(product);
        Instant publishedAt = Instant.parse("2026-11-01T09:00:00Z");

        publicationLog.append(product.id(), publishedAt);
        publicationLog.append(product.id(), publishedAt.plusSeconds(60));

        Long rows = jdbc.sql("select count(*) from catalog_publication_log where product_id = :id")
                .param("id", product.id().value())
                .query(Long.class)
                .single();
        assertThat(rows).isEqualTo(1);
        assertThat(storedInstant("catalog_publication_log", "product_id", product.id())).isEqualTo(publishedAt);
    }

    private Instant storedInstant(String table, String idColumn, ProductId id) {
        return jdbc.sql("select published_at from " + table + " where " + idColumn + " = :id")
                .param("id", id.value())
                .query((row, _) -> row.getObject("published_at", OffsetDateTime.class).toInstant())
                .single();
    }

    private long rowCount(ProductId id) {
        return jdbc.sql("select count(*) from catalog_product where id = :id")
                .param("id", id.value())
                .query(Long.class)
                .single();
    }
}
