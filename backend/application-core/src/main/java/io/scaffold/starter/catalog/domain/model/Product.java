package io.scaffold.starter.catalog.domain.model;

import io.scaffold.starter.catalog.domain.event.ProductPublished;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.shared.Money;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import org.jmolecules.ddd.annotation.AggregateRoot;
import org.jmolecules.ddd.annotation.Identity;

@AggregateRoot
public class Product {

    static final int MAX_NAME_LENGTH = 120;
    static final long INITIAL_VERSION = 0;

    @Identity
    private final ProductId id;
    private final String name;
    private final Money price;
    private ProductStatus status;
    private Instant publishedAt;
    private final long loadedVersion;

    private Product(
            ProductId id, String name, Money price, ProductStatus status, Instant publishedAt, long loadedVersion) {
        this.id = Objects.requireNonNull(id, "id");
        this.name = name;
        this.price = price;
        this.status = status;
        this.publishedAt = publishedAt;
        this.loadedVersion = loadedVersion;
    }

    public static Product draft(ProductId id, String name, Money price) {
        String trimmed = Objects.requireNonNull(name, "name").strip();
        if (trimmed.isEmpty() || trimmed.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Product name must be 1 to " + MAX_NAME_LENGTH + " characters");
        }
        return new Product(id, trimmed, price, ProductStatus.DRAFT, null, INITIAL_VERSION);
    }

    public static Product rehydrate(
            ProductId id, String name, Money price, ProductStatus status, Instant publishedAt, long storedVersion) {
        return new Product(id, name, price, Objects.requireNonNull(status, "status"), publishedAt, storedVersion);
    }

    public PublishCheck checkPublish() {
        if (status != ProductStatus.DRAFT) {
            return PublishCheck.NOT_DRAFT;
        }
        return price == null ? PublishCheck.NO_PRICE : PublishCheck.OK;
    }

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

    public long loadedVersion() {
        return loadedVersion;
    }
}
