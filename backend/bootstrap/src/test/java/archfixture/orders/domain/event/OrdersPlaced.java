package archfixture.orders.domain.event;

import archfixture.orders.domain.model.Order;
import java.util.List;

public record OrdersPlaced(List<Order> orders) {
}
