package io.scaffold.starter.catalog.application.port.in;

import java.util.List;

public interface ListProducts {

    /** All products ordered by name, ignoring case. */
    List<ProductView> list();
}
