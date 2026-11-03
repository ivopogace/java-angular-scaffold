package io.scaffold.starter.catalog.application.port.in;

import io.scaffold.starter.shared.Money;

/** @param price null while undecided */
public record CreateProductCommand(String name, Money price) {
}
