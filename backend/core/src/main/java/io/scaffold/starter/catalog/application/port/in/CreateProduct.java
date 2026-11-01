package io.scaffold.starter.catalog.application.port.in;

public interface CreateProduct {

    /** @throws IllegalArgumentException if the name is blank or longer than 120 characters */
    ProductView create(CreateProductCommand command);
}
