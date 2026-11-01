package io.scaffold.starter.catalog.application.port.in;

import io.scaffold.starter.shared.Money;

/**
 * @param name 1 to 120 characters once stripped of surrounding whitespace
 * @param price the price, or null while undecided
 */
public record CreateProductCommand(String name, Money price) {
}
