package archfixture.orders.application.port.in;

import archfixture.orders.domain.model.Order;

public record LeakyOrderView(Order order) {
}
