package archfixture.orders.adapter.out.reporting;

import org.jooq.impl.DefaultDSLContext;

class DefaultContextOrderReport {

    int purge(DefaultDSLContext dsl) {
        return dsl.execute("delete from orders");
    }
}
