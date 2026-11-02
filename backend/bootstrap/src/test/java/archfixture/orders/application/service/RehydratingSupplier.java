package archfixture.orders.application.service;

import archfixture.orders.domain.model.Order;
import java.util.function.Supplier;

class RehydratingSupplier {

    Supplier<Order> loader() {
        return Order::rehydrate;
    }
}
