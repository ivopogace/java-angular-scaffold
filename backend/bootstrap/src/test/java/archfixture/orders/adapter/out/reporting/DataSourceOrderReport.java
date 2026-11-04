package archfixture.orders.adapter.out.reporting;

import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;

class DataSourceOrderReport {

    private final DataSource dataSource;

    DataSourceOrderReport(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    boolean any() throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            return connection.prepareStatement("select 1 from orders").executeQuery().next();
        }
    }
}
