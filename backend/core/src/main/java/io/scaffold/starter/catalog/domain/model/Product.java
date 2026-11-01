package io.scaffold.starter.catalog.domain.model;

import io.scaffold.starter.catalog.domain.event.ProductPublished;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.shared.Money;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import org.jmolecules.ddd.annotation.AggregateRoot;
import org.jmolecules.ddd.annotation.Identity;

/**
 * A catalog product. It starts as a draft, can be published once it has a price, and a published
 * product can be retired.
 */
@AggregateRoot
public class Product {

    static final int MAX_NAME_LENGTH = 120;

    @Identity
    private final ProductId id;
    private final String name;
    private final Money price;
    private ProductStatus status;
    private Instant publishedAt;

    private Product(ProductId id, String name, Money price, ProductStatus status, Instant publishedAt) {
        this.id = Objects.requireNonNull(id, "id");
        this.name = name;
        this.price = price;
        this.status = status;
        this.publishedAt = publishedAt;
    }

    /**
     * @param price the price, or {@code null} while undecided
     * @throws IllegalArgumentException if the stripped name is empty or longer than 120 characters
     */
    public static Product draft(ProductId id, String name, Money price) {
        String trimmed = Objects.requireNonNull(name, "name").strip();
        if (trimmed.isEmpty() || trimmed.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Product name must be 1 to " + MAX_NAME_LENGTH + " characters");
        }
        return new Product(id, trimmed, price, ProductStatus.DRAFT, null);
    }

    /** Rebuilds a stored product without re-running creation rules. */
    public static Product rehydrate(
            ProductId id, String name, Money price, ProductStatus status, Instant publishedAt) {
        return new Product(id, name, price, Objects.requireNonNull(status, "status"), publishedAt);
    }

    public PublishCheck checkPublish() {
        if (status != ProductStatus.DRAFT) {
            return PublishCheck.NOT_DRAFT;
        }
        return price == null ? PublishCheck.NO_PRICE : PublishCheck.OK;
    }

    /** @throws IllegalStateException unless {@link #checkPublish()} is {@link PublishCheck#OK} */
    public ProductPublished publish(Instant now) {
        PublishCheck check = checkPublish();
        if (check != PublishCheck.OK) {
            throw new IllegalStateException("Cannot publish product " + id.value() + ": " + check);
        }
        status = ProductStatus.PUBLISHED;
        publishedAt = Objects.requireNonNull(now, "now");
        return new ProductPublished(id, now);
    }

    public boolean canRetire() {
        return status == ProductStatus.PUBLISHED;
    }

    /** @throws IllegalStateException unless the product is published */
    public void retire() {
        if (!canRetire()) {
            throw new IllegalStateException("Cannot retire product " + id.value() + " in status " + status);
        }
        status = ProductStatus.RETIRED;
    }

    public ProductId id() {
        return id;
    }

    public String name() {
        return name;
    }

    public Optional<Money> price() {
        return Optional.ofNullable(price);
    }

    public ProductStatus status() {
        return status;
    }

    public Optional<Instant> publishedAt() {
        return Optional.ofNullable(publishedAt);
    }
}
