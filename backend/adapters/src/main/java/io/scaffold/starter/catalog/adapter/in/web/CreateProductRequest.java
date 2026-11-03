package io.scaffold.starter.catalog.adapter.in.web;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

record CreateProductRequest(
        @NotBlank @Size(max = 120) String name,
        @PositiveOrZero Long priceMinor,
        @Pattern(regexp = "[A-Z]{3}") String currency) {

    // Stripped first so the constraints judge the value the domain will see.
    CreateProductRequest {
        name = name == null ? null : name.strip();
    }

    @AssertTrue(message = "priceMinor and currency must be given together")
    boolean isPriceComplete() {
        return (priceMinor == null) == (currency == null);
    }
}
