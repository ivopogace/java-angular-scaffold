package archfixture.orders.adapter.out.reporting;

import java.util.List;
import org.jooq.Field;
import org.jooq.impl.DSL;

class MethodReferenceOrderReport {

    List<Field<Object>> columns(List<String> names) {
        return names.stream().map(DSL::field).toList();
    }
}
