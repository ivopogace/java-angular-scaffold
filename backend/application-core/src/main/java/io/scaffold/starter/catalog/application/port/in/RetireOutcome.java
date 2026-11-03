package io.scaffold.starter.catalog.application.port.in;

public sealed interface RetireOutcome {

    record Retired(ProductView product) implements RetireOutcome {
    }

    record NotFound() implements RetireOutcome {
    }

    record NotPublished() implements RetireOutcome {
    }
}
