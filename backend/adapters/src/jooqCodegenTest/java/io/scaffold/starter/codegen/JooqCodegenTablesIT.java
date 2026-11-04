package io.scaffold.starter.codegen;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/** Every kind of table jOOQ can generate is checked against the area naming rule. */
@Tag("container")
class JooqCodegenTablesIT {

    @Test
    void listsPartitionedForeignAndMaterializedTablesAndViews() throws Exception {
        String image = System.getProperty("postgres.image");
        try (PostgreSQLContainer postgres = new PostgreSQLContainer(
                DockerImageName.parse(image).asCompatibleSubstituteFor("postgres"))) {
            postgres.start();
            try (Connection connection = DriverManager.getConnection(
                            postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
                    Statement statement = connection.createStatement()) {
                statement.execute("create table invoice (id int, issued date) partition by range (issued)");
                statement.execute("create table invoice_2026 partition of invoice "
                        + "for values from ('2026-01-01') to ('2027-01-01')");
                statement.execute("create view open_invoice as select id from invoice");
                statement.execute("create materialized view sales_summary as select count(*) from invoice");
                statement.execute("create extension postgres_fdw");
                statement.execute("create server remote foreign data wrapper postgres_fdw");
                statement.execute("create foreign table remote_order (id int) server remote");

                assertThat(JooqCodegen.tables(connection)).containsExactlyInAnyOrder(
                        "invoice", "invoice_2026", "open_invoice", "sales_summary", "remote_order");
            }
        }
    }
}
