package io.scaffold.starter.catalog.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.scaffold.starter.catalog.domain.event.ProductPublished;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.shared.Money;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class ProductTest {

    private static final Instant NOW = Instant.parse("2030-01-14T12:00:00Z");
    private static final Money PRICE = Money.of(1_250, "EUR");

    @Test
    void draftRejectsBlankName() {
        assertThatThrownBy(() -> Product.draft(ProductId.newId(), "   ", PRICE))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Product.draft(ProductId.newId(), "\u2003\u2003", PRICE))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void draftRejectsNameLongerThan120Characters() {
        assertThatThrownBy(() -> Product.draft(ProductId.newId(), "x".repeat(121), PRICE))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void draftTrimsNameAndAcceptsExactly120Characters() {
        assertThat(Product.draft(ProductId.newId(), "  Lamp  ", null).name()).isEqualTo("Lamp");
        assertThat(Product.draft(ProductId.newId(), "x".repeat(120), null).name()).hasSize(120);
    }

    @Test
    void draftStartsAsDraftWithoutPublicationTime() {
        Product product = Product.draft(ProductId.newId(), "Lamp", PRICE);

        assertThat(product.status()).isEqualTo(ProductStatus.DRAFT);
        assertThat(product.price()).contains(PRICE);
        assertThat(product.publishedAt()).isEmpty();
        assertThat(product.loadedVersion()).isEqualTo(Product.INITIAL_VERSION);
    }

    @Test
    void checkPublishNeedsAPrice() {
        assertThat(Product.draft(ProductId.newId(), "Lamp", null).checkPublish()).isEqualTo(PublishCheck.NO_PRICE);
        assertThat(Product.draft(ProductId.newId(), "Lamp", PRICE).checkPublish()).isEqualTo(PublishCheck.OK);
    }

    @Test
    void publishMarksPublishedAndReturnsTheEvent() {
        ProductId id = ProductId.newId();
        Product product = Product.draft(id, "Lamp", PRICE);

        ProductPublished event = product.publish(NOW);

        assertThat(event).isEqualTo(new ProductPublished(id, NOW));
        assertThat(product.status()).isEqualTo(ProductStatus.PUBLISHED);
        assertThat(product.publishedAt()).contains(NOW);
        assertThat(product.checkPublish()).isEqualTo(PublishCheck.NOT_DRAFT);
    }

    @Test
    void publishWithoutPriceIsAnIllegalState() {
        Product product = Product.draft(ProductId.newId(), "Lamp", null);

        assertThatThrownBy(() -> product.publish(NOW)).isInstanceOf(IllegalStateException.class);
        assertThat(product.status()).isEqualTo(ProductStatus.DRAFT);
    }

    @Test
    void onlyAPublishedProductCanRetire() {
        Product product = Product.draft(ProductId.newId(), "Lamp", PRICE);
        assertThat(product.canRetire()).isFalse();
        assertThatThrownBy(product::retire).isInstanceOf(IllegalStateException.class);

        product.publish(NOW);
        assertThat(product.canRetire()).isTrue();

        product.retire();
        assertThat(product.status()).isEqualTo(ProductStatus.RETIRED);
        assertThat(product.canRetire()).isFalse();
    }

    @Test
    void rehydrateRestoresStoredState() {
        ProductId id = ProductId.newId();

        Product product = Product.rehydrate(id, "Lamp", PRICE, ProductStatus.PUBLISHED, NOW, 7);

        assertThat(product.id()).isEqualTo(id);
        assertThat(product.status()).isEqualTo(ProductStatus.PUBLISHED);
        assertThat(product.publishedAt()).contains(NOW);
        assertThat(product.loadedVersion()).isEqualTo(7);
    }

    @Test
    void aTransitionKeepsTheLoadedVersion() {
        Product product = Product.rehydrate(ProductId.newId(), "Lamp", PRICE, ProductStatus.DRAFT, null, 3);

        product.publish(NOW);
        product.retire();

        assertThat(product.loadedVersion()).isEqualTo(3);
    }
}
