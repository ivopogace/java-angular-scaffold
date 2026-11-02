package archfixture.orders.application.service;

import archfixture.orders.domain.model.Order;

class RehydratingService {

    Order load() {
        return Order.rehydrate();
    }
}
