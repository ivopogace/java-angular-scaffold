package io.scaffold.starter.catalog.application.port.in;

public sealed interface PublishOutcome {

    enum Reason {
        NOT_DRAFT,
        NO_PRICE
    }

    record Published(ProductView product) implements PublishOutcome {
    }

    record NotFound() implements PublishOutcome {
    }

    record Rejected(Reason reason) implements PublishOutcome {
    }

    /** Another write changed the product after it was loaded; nothing was written or published. */
    record ConcurrentChange() implements PublishOutcome {
    }
}
