package io.scaffold.starter.catalog.application.service;

import io.scaffold.starter.catalog.application.port.in.CreateProduct;
import io.scaffold.starter.catalog.application.port.in.CreateProductCommand;
import io.scaffold.starter.catalog.application.port.in.FindProduct;
import io.scaffold.starter.catalog.application.port.in.ListProducts;
import io.scaffold.starter.catalog.application.port.in.ProductState;
import io.scaffold.starter.catalog.application.port.in.ProductView;
import io.scaffold.starter.catalog.application.port.in.PublishOutcome;
import io.scaffold.starter.catalog.application.port.in.PublishProduct;
import io.scaffold.starter.catalog.application.port.in.RetireOutcome;
import io.scaffold.starter.catalog.application.port.in.RetireProduct;
import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.domain.event.ProductPublished;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import io.scaffold.starter.catalog.domain.model.PublishCheck;
import io.scaffold.starter.shared.DomainEventPublisher;
import io.scaffold.starter.shared.UseCase;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@UseCase
class CatalogService implements CreateProduct, FindProduct, PublishProduct, RetireProduct, ListProducts {

    private final ProductRepository products;
    private final DomainEventPublisher events;
    private final Clock clock;

    CatalogService(ProductRepository products, DomainEventPublisher events, Clock clock) {
        this.products = products;
        this.events = events;
        this.clock = clock;
    }

    @Override
    @Transactional
    public ProductView create(CreateProductCommand command) {
        Product product = Product.draft(ProductId.newId(), command.name(), command.price());
        products.add(product);
        return toView(product);
    }

    @Override
    @Transactional
    public Optional<ProductView> find(ProductId id) {
        return products.findById(id).map(CatalogService::toView);
    }

    @Override
    @Transactional
    public PublishOutcome publish(ProductId id) {
        Optional<Product> found = products.findById(id);
        if (found.isEmpty()) {
            return new PublishOutcome.NotFound();
        }
        Product product = found.get();
        PublishCheck check = product.checkPublish();
        if (check != PublishCheck.OK) {
            return new PublishOutcome.Rejected(reasonFor(check));
        }
        ProductPublished event = product.publish(clock.instant());
        if (!products.update(product)) {
            return new PublishOutcome.ConcurrentChange();
        }
        events.publish(event);
        return new PublishOutcome.Published(toView(product));
    }

    @Override
    @Transactional
    public RetireOutcome retire(ProductId id) {
        Optional<Product> found = products.findById(id);
        if (found.isEmpty()) {
            return new RetireOutcome.NotFound();
        }
        Product product = found.get();
        if (!product.canRetire()) {
            return new RetireOutcome.NotPublished();
        }
        product.retire();
        if (!products.update(product)) {
            return new RetireOutcome.ConcurrentChange();
        }
        return new RetireOutcome.Retired(toView(product));
    }

    @Override
    @Transactional
    public List<ProductView> list() {
        return products.findAll().stream()
                .sorted(Comparator.comparing(Product::name, String.CASE_INSENSITIVE_ORDER))
                .map(CatalogService::toView)
                .toList();
    }

    private static PublishOutcome.Reason reasonFor(PublishCheck check) {
        return switch (check) {
            case NOT_DRAFT -> PublishOutcome.Reason.NOT_DRAFT;
            case NO_PRICE -> PublishOutcome.Reason.NO_PRICE;
            case OK -> throw new IllegalArgumentException("OK is not a rejection");
        };
    }

    private static ProductView toView(Product product) {
        return new ProductView(
                product.id(),
                product.name(),
                product.price().orElse(null),
                ProductState.valueOf(product.status().name()),
                product.publishedAt().orElse(null));
    }
}
