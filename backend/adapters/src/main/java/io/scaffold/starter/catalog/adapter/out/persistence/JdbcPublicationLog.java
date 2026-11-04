package io.scaffold.starter.catalog.adapter.out.persistence;

import io.scaffold.starter.catalog.application.port.out.PublicationLog;
import io.scaffold.starter.catalog.domain.id.ProductId;
import java.time.Instant;
import org.springframework.stereotype.Repository;

@Repository
class JdbcPublicationLog implements PublicationLog {

    private final PublicationLogRows rows;

    JdbcPublicationLog(PublicationLogRows rows) {
        this.rows = rows;
    }

    @Override
    public void append(ProductId id, Instant publishedAt) {
        rows.insertIfAbsent(id.value(), publishedAt);
    }
}
