package archfixture.orders.application.port.out;

import archfixture.orders.domain.model.Order;

public interface OrderRepository {

    void save(Order order);
}
