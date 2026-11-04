package archfixture.orders.adapter.out.reporting;

import org.jooq.Field;
import org.jooq.impl.DSL;

class PlainSqlOrderReport {

    Field<Object> total() {
        return DSL.field("total");
    }
}
