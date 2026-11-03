package archfixture.orders.adapter.out.persistence;

import org.springframework.jdbc.core.simple.JdbcClient;

class JdbcClientOrderRepository {

    private final JdbcClient jdbc;

    JdbcClientOrderRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }
}
