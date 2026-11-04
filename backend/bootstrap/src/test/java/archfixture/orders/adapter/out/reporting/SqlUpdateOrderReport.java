package archfixture.orders.adapter.out.reporting;

import org.springframework.jdbc.object.SqlUpdate;

class SqlUpdateOrderReport {

    private final SqlUpdate purge;

    SqlUpdateOrderReport(SqlUpdate purge) {
        this.purge = purge;
    }
}
