package archfixture.orders.adapter.out.reporting;

import org.springframework.jdbc.core.simple.JdbcClient;

class JdbcClientOrderReport {

    private final JdbcClient jdbc;

    JdbcClientOrderReport(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }
}
