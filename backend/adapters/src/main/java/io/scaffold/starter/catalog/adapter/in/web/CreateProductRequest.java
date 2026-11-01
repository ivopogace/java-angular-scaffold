package io.scaffold.starter.catalog.adapter.in.web;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * @param priceMinor price in minor units; sent together with {@code currency} or not at all
 * @param currency ISO 4217 code
 */
record CreateProductRequest(
        @NotBlank @Size(max = 120) String name,
        @PositiveOrZero Long priceMinor,
        @Pattern(regexp = "[A-Z]{3}") String currency) {

    @AssertTrue(message = "priceMinor and currency must be given together")
    boolean isPriceComplete() {
        return (priceMinor == null) == (currency == null);
    }
}
