package archfixture.orders.adapter.out.persistence;

import org.jooq.Field;
import org.jooq.impl.DSL;

class PlainSqlOrderRepository {

    Field<Object> total() {
        return DSL.field("total");
    }
}
