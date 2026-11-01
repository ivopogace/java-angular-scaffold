package io.scaffold.starter.catalog.adapter.out.persistence;

import io.scaffold.starter.catalog.application.port.out.PublicationLog;
import io.scaffold.starter.catalog.domain.id.ProductId;
import java.time.Instant;
import java.time.ZoneOffset;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class JdbcPublicationLog implements PublicationLog {

    private final JdbcClient jdbc;

    JdbcPublicationLog(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void append(ProductId id, Instant publishedAt) {
        jdbc.sql("""
                        insert into catalog_publication_log (product_id, published_at)
                        values (:id, :publishedAt)
                        on conflict do nothing
                        """)
                .param("id", id.value())
                .param("publishedAt", publishedAt.atOffset(ZoneOffset.UTC))
                .update();
    }
}
