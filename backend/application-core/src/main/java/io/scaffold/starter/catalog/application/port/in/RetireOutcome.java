package io.scaffold.starter.catalog.application.port.in;

public sealed interface RetireOutcome {

    record Retired(ProductView product) implements RetireOutcome {
    }

    record NotFound() implements RetireOutcome {
    }

    record NotPublished() implements RetireOutcome {
    }

    /** Another write changed the product after it was loaded; nothing was written. */
    record ConcurrentChange() implements RetireOutcome {
    }
}
