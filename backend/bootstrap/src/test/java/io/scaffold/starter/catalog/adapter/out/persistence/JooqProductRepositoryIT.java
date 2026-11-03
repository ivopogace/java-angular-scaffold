package io.scaffold.starter.catalog.adapter.out.persistence;

import static io.scaffold.starter.catalog.adapter.out.persistence.jooq.Tables.CATALOG_PRODUCT;
import static io.scaffold.starter.catalog.adapter.out.persistence.jooq.Tables.CATALOG_PUBLICATION_LOG;
import static org.assertj.core.api.Assertions.assertThat;

import io.scaffold.starter.TestcontainersConfiguration;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import io.scaffold.starter.catalog.domain.model.ProductStatus;
import io.scaffold.starter.shared.Money;
import java.time.Instant;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.modulith.test.ApplicationModuleTest;

@ApplicationModuleTest
@Import(TestcontainersConfiguration.class)
@Tag("container")
class JooqProductRepositoryIT {

    @Autowired
    JooqProductRepository products;

    @Autowired
    JooqPublicationLog publicationLog;

    @Autowired
    DSLContext dsl;

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
    void appendingTheSamePublicationTwiceLeavesOneRow() {
        Product product = Product.draft(ProductId.newId(), "Mug", Money.of(800, "EUR"));
        products.save(product);
        Instant publishedAt = Instant.parse("2026-11-01T09:00:00Z");

        publicationLog.append(product.id(), publishedAt);
        publicationLog.append(product.id(), publishedAt.plusSeconds(60));

        assertThat(dsl.fetchCount(CATALOG_PUBLICATION_LOG, CATALOG_PUBLICATION_LOG.PRODUCT_ID.eq(product.id().value())))
                .isEqualTo(1);
    }

    private int rowCount(ProductId id) {
        return dsl.fetchCount(CATALOG_PRODUCT, CATALOG_PRODUCT.ID.eq(id.value()));
    }
}
