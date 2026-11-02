package archfixture.orders.adapter.in.web;

import archfixture.orders.domain.model.Order;

class AggregateController {

    Order show() {
        return new Order();
    }
}
