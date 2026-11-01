package io.scaffold.starter.catalog.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.scaffold.starter.catalog.application.port.in.CreateProductCommand;
import io.scaffold.starter.catalog.application.port.in.ProductState;
import io.scaffold.starter.catalog.application.port.in.ProductView;
import io.scaffold.starter.catalog.application.port.in.PublishOutcome;
import io.scaffold.starter.catalog.application.port.in.RetireOutcome;
import io.scaffold.starter.catalog.domain.event.ProductPublished;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.shared.Money;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class CatalogServiceTest {

    private static final Instant NOW = Instant.parse("2030-01-14T12:00:00Z");
    private static final Money PRICE = Money.of(1_250, "EUR");

    private final RecordingEventPublisher events = new RecordingEventPublisher();
    private final CatalogService service = new CatalogService(
            new InMemoryProductRepository(), events, Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void createReturnsADraftView() {
        ProductView view = service.create(new CreateProductCommand("Lamp", PRICE));

        assertThat(view.name()).isEqualTo("Lamp");
        assertThat(view.price()).isEqualTo(PRICE);
        assertThat(view.state()).isEqualTo(ProductState.DRAFT);
        assertThat(view.publishedAt()).isNull();
    }

    @Test
    void publishOfAnUnknownProductIsNotFound() {
        assertThat(service.publish(ProductId.newId())).isInstanceOf(PublishOutcome.NotFound.class);
    }

    @Test
    void publishWithoutPriceIsRejectedAndPublishesNothing() {
        ProductView draft = service.create(new CreateProductCommand("Lamp", null));

        assertThat(service.publish(draft.id()))
                .isEqualTo(new PublishOutcome.Rejected(PublishOutcome.Reason.NO_PRICE));
        assertThat(events.published()).isEmpty();
    }

    @Test
    void publishWithPriceStampsTheClockAndPublishesOneEvent() {
        ProductView draft = service.create(new CreateProductCommand("Lamp", PRICE));

        PublishOutcome outcome = service.publish(draft.id());

        assertThat(outcome).isInstanceOfSatisfying(PublishOutcome.Published.class, published -> {
            assertThat(published.product().state()).isEqualTo(ProductState.PUBLISHED);
            assertThat(published.product().publishedAt()).isEqualTo(NOW);
        });
        assertThat(events.published()).containsExactly(new ProductPublished(draft.id(), NOW));
    }

    @Test
    void publishingTwiceRejectsTheSecondAsNotDraft() {
        ProductView draft = service.create(new CreateProductCommand("Lamp", PRICE));
        service.publish(draft.id());

        assertThat(service.publish(draft.id()))
                .isEqualTo(new PublishOutcome.Rejected(PublishOutcome.Reason.NOT_DRAFT));
        assertThat(events.published()).hasSize(1);
    }

    @Test
    void retireOfAnUnknownProductIsNotFound() {
        assertThat(service.retire(ProductId.newId())).isInstanceOf(RetireOutcome.NotFound.class);
    }

    @Test
    void retireOfADraftIsNotPublished() {
        ProductView draft = service.create(new CreateProductCommand("Lamp", PRICE));

        assertThat(service.retire(draft.id())).isInstanceOf(RetireOutcome.NotPublished.class);
    }

    @Test
    void retireOfAPublishedProductRetiresIt() {
        ProductView draft = service.create(new CreateProductCommand("Lamp", PRICE));
        service.publish(draft.id());

        assertThat(service.retire(draft.id())).isInstanceOfSatisfying(RetireOutcome.Retired.class,
                retired -> assertThat(retired.product().state()).isEqualTo(ProductState.RETIRED));
    }

    @Test
    void listOrdersByNameIgnoringCase() {
        service.create(new CreateProductCommand("cherry", null));
        service.create(new CreateProductCommand("Banana", null));
        service.create(new CreateProductCommand("apple", null));

        assertThat(service.list()).extracting(ProductView::name)
                .isEqualTo(List.of("apple", "Banana", "cherry"));
    }
}
