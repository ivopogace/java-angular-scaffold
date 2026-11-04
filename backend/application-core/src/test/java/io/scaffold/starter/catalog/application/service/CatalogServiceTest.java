package io.scaffold.starter.catalog.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.scaffold.starter.catalog.application.port.in.CreateProductCommand;
import io.scaffold.starter.catalog.application.port.in.ProductState;
import io.scaffold.starter.catalog.application.port.in.ProductView;
import io.scaffold.starter.catalog.application.port.in.PublishOutcome;
import io.scaffold.starter.catalog.application.port.in.RetireOutcome;
import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.application.port.out.ProductRepository.UpdateResult;
import io.scaffold.starter.catalog.domain.event.ProductPublished;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import io.scaffold.starter.shared.Money;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CatalogServiceTest {

    private static final Instant NOW = Instant.parse("2030-01-14T12:00:00Z");
    private static final Money PRICE = Money.of(1_250, "EUR");

    private final RecordingEventPublisher events = new RecordingEventPublisher();
    private final InterleavingRepository products = new InterleavingRepository(new InMemoryProductRepository());
    private final CatalogService service = new CatalogService(products, events, Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void createReturnsADraftView() {
        ProductView view = service.create(new CreateProductCommand("Lamp", PRICE));

        assertThat(view.name()).isEqualTo("Lamp");
        assertThat(view.price()).isEqualTo(PRICE);
        assertThat(view.state()).isEqualTo(ProductState.DRAFT);
        assertThat(view.publishedAt()).isNull();
    }

    @Test
    void findReturnsTheStoredProduct() {
        ProductView created = service.create(new CreateProductCommand("Lamp", PRICE));

        assertThat(service.find(created.id())).contains(created);
    }

    @Test
    void findOfAnUnknownProductIsEmpty() {
        assertThat(service.find(ProductId.newId())).isEmpty();
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
    void publishPersistsTheTransition() {
        ProductView draft = service.create(new CreateProductCommand("Lamp", PRICE));

        service.publish(draft.id());

        assertThat(service.list()).singleElement().satisfies(stored -> {
            assertThat(stored.state()).isEqualTo(ProductState.PUBLISHED);
            assertThat(stored.publishedAt()).isEqualTo(NOW);
        });
    }

    @Test
    void retirePersistsTheTransition() {
        ProductView draft = service.create(new CreateProductCommand("Lamp", PRICE));
        service.publish(draft.id());

        service.retire(draft.id());

        assertThat(service.list()).singleElement()
                .satisfies(stored -> assertThat(stored.state()).isEqualTo(ProductState.RETIRED));
    }

    @Test
    void listOrdersByNameIgnoringCase() {
        service.create(new CreateProductCommand("cherry", null));
        service.create(new CreateProductCommand("Banana", null));
        service.create(new CreateProductCommand("apple", null));

        assertThat(service.list()).extracting(ProductView::name)
                .isEqualTo(List.of("apple", "Banana", "cherry"));
    }

    @Test
    void ofTwoPublishesThatLoadedTheSameDraftOnlyTheFirstToSaveWinsAndPublishes() {
        ProductView draft = service.create(new CreateProductCommand("Lamp", PRICE));
        PublishOutcome[] concurrent = new PublishOutcome[1];
        products.runBeforeNextUpdate(() -> concurrent[0] = service.publish(draft.id()));

        PublishOutcome stale = service.publish(draft.id());

        assertThat(concurrent[0]).isInstanceOf(PublishOutcome.Published.class);
        assertThat(stale).isInstanceOf(PublishOutcome.ConcurrentChange.class);
        assertThat(events.published()).containsExactly(new ProductPublished(draft.id(), NOW));
    }

    @Test
    void aRetireThatLoadedTheProductBeforeAConcurrentRetireIsAConcurrentChange() {
        ProductView draft = service.create(new CreateProductCommand("Lamp", PRICE));
        service.publish(draft.id());
        RetireOutcome[] concurrent = new RetireOutcome[1];
        products.runBeforeNextUpdate(() -> concurrent[0] = service.retire(draft.id()));

        RetireOutcome stale = service.retire(draft.id());

        assertThat(concurrent[0]).isInstanceOf(RetireOutcome.Retired.class);
        assertThat(stale).isInstanceOf(RetireOutcome.ConcurrentChange.class);
        assertThat(service.find(draft.id())).hasValueSatisfying(
                stored -> assertThat(stored.state()).isEqualTo(ProductState.RETIRED));
    }

    private static final class InterleavingRepository implements ProductRepository {

        private final ProductRepository delegate;
        private Runnable pendingConcurrentUseCase;

        InterleavingRepository(ProductRepository delegate) {
            this.delegate = delegate;
        }

        void runBeforeNextUpdate(Runnable concurrentUseCase) {
            pendingConcurrentUseCase = concurrentUseCase;
        }

        @Override
        public void addNew(Product product) {
            delegate.addNew(product);
        }

        @Override
        public UpdateResult updateIfUnchangedSinceLoad(Product product) {
            Runnable concurrentUseCase = pendingConcurrentUseCase;
            pendingConcurrentUseCase = null;
            if (concurrentUseCase != null) {
                concurrentUseCase.run();
            }
            return delegate.updateIfUnchangedSinceLoad(product);
        }

        @Override
        public Optional<Product> findById(ProductId id) {
            return delegate.findById(id);
        }

        @Override
        public List<Product> findAll() {
            return delegate.findAll();
        }
    }
}
