package io.scaffold.starter.catalog.domain.model;

/** Whether a product may be published now, and if not, why. */
public enum PublishCheck {
    OK,
    NOT_DRAFT,
    NO_PRICE
}
