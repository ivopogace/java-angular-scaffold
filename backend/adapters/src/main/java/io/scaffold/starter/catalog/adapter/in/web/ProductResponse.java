package io.scaffold.starter.catalog.adapter.in.web;

import io.scaffold.starter.catalog.application.port.in.ProductView;
import java.time.Instant;

record ProductResponse(
        String id, String name, Long priceMinor, String currency, String state, Instant publishedAt) {

    static ProductResponse from(ProductView view) {
        return new ProductResponse(
                view.id().value().toString(),
                view.name(),
                view.price() == null ? null : view.price().amountMinor(),
                view.price() == null ? null : view.price().currency().getCurrencyCode(),
                view.state().name(),
                view.publishedAt());
    }
}
