package io.scaffold.starter.catalog.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import io.scaffold.starter.TestcontainersConfiguration;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import io.scaffold.starter.catalog.domain.model.ProductStatus;
import io.scaffold.starter.shared.Money;
import java.time.Instant;
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
                ProductId.newId(), "Linen shirt", Money.of(4999, "EUR"), ProductStatus.PUBLISHED, publishedAt, 4);

        products.add(saved);

        Product loaded = products.findById(saved.id()).orElseThrow();
        assertThat(loaded.id()).isEqualTo(saved.id());
        assertThat(loaded.name()).isEqualTo("Linen shirt");
        assertThat(loaded.price()).contains(Money.of(4999, "EUR"));
        assertThat(loaded.status()).isEqualTo(ProductStatus.PUBLISHED);
        assertThat(loaded.publishedAt()).contains(publishedAt);
        assertThat(loaded.version()).isEqualTo(4);
    }

    @Test
    void roundTripsAnUnpricedDraft() {
        Product draft = Product.draft(ProductId.newId(), "Mystery box", null);

        products.add(draft);

        Product loaded = products.findById(draft.id()).orElseThrow();
        assertThat(loaded.price()).isEmpty();
        assertThat(loaded.publishedAt()).isEmpty();
        assertThat(loaded.status()).isEqualTo(ProductStatus.DRAFT);
    }

    @Test
    void anUpdateAtTheLoadedVersionWritesAndIncrementsTheVersion() {
        Product draft = Product.draft(ProductId.newId(), "Candle", Money.of(1200, "EUR"));
        products.add(draft);
        Product loaded = products.findById(draft.id()).orElseThrow();
        loaded.publish(Instant.parse("2026-11-01T08:00:00Z"));

        assertThat(products.update(loaded)).isTrue();

        assertThat(rowCount(draft.id())).isEqualTo(1);
        Product stored = products.findById(draft.id()).orElseThrow();
        assertThat(stored.status()).isEqualTo(ProductStatus.PUBLISHED);
        assertThat(stored.version()).isEqualTo(loaded.version() + 1);
    }

    @Test
    void anUpdateFromAStaleLoadWritesNothing() {
        Product draft = Product.draft(ProductId.newId(), "Candle", Money.of(1200, "EUR"));
        products.add(draft);
        Product first = products.findById(draft.id()).orElseThrow();
        Product second = products.findById(draft.id()).orElseThrow();
        Instant firstPublish = Instant.parse("2026-11-01T08:00:00Z");
        first.publish(firstPublish);
        second.publish(firstPublish.plusSeconds(60));
        assertThat(products.update(first)).isTrue();

        assertThat(products.update(second)).isFalse();

        Product stored = products.findById(draft.id()).orElseThrow();
        assertThat(stored.publishedAt()).contains(firstPublish);
        assertThat(stored.version()).isEqualTo(first.version() + 1);
    }

    @Test
    void anUpdateOfAProductThatIsNotStoredWritesNothing() {
        Product unsaved = Product.draft(ProductId.newId(), "Ghost", null);

        assertThat(products.update(unsaved)).isFalse();

        assertThat(rowCount(unsaved.id())).isZero();
    }

    @Test
    void findByIdOfAnUnknownIdIsEmpty() {
        assertThat(products.findById(ProductId.newId())).isEmpty();
    }

    @Test
    void findAllReturnsEveryStoredProduct() {
        Product first = Product.draft(ProductId.newId(), "First", null);
        Product second = Product.draft(ProductId.newId(), "Second", Money.of(100, "ALL"));
        products.add(first);
        products.add(second);

        assertThat(products.findAll()).extracting(Product::id).contains(first.id(), second.id());
    }

    @Test
    void appendingTheSamePublicationTwiceLeavesOneRow() {
        Product product = Product.draft(ProductId.newId(), "Mug", Money.of(800, "EUR"));
        products.add(product);
        Instant publishedAt = Instant.parse("2026-11-01T09:00:00Z");

        publicationLog.append(product.id(), publishedAt);
        publicationLog.append(product.id(), publishedAt.plusSeconds(60));

        Long rows = jdbc.sql("select count(*) from catalog_publication_log where product_id = :id")
                .param("id", product.id().value())
                .query(Long.class)
                .single();
        assertThat(rows).isEqualTo(1);
    }

    private long rowCount(ProductId id) {
        return jdbc.sql("select count(*) from catalog_product where id = :id")
                .param("id", id.value())
                .query(Long.class)
                .single();
    }
}
