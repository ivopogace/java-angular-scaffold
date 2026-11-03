package archfixture.orders.adapter.in.web;

import archfixture.orders.adapter.out.persistence.jooq.Orders;

class TableController {

    Orders table() {
        return new Orders();
    }
}
