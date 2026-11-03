package io.scaffold.starter.catalog.adapter.out.persistence;

import static io.scaffold.starter.catalog.adapter.out.persistence.jooq.Tables.CATALOG_PUBLICATION_LOG;

import io.scaffold.starter.catalog.application.port.out.PublicationLog;
import io.scaffold.starter.catalog.domain.id.ProductId;
import java.time.Instant;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
class JooqPublicationLog implements PublicationLog {

    private final DSLContext dsl;

    JooqPublicationLog(DSLContext dsl) {
        this.dsl = dsl;
    }

    @Override
    public void append(ProductId id, Instant publishedAt) {
        dsl.insertInto(CATALOG_PUBLICATION_LOG)
                .set(CATALOG_PUBLICATION_LOG.PRODUCT_ID, id.value())
                .set(CATALOG_PUBLICATION_LOG.PUBLISHED_AT, publishedAt)
                .onConflictDoNothing()
                .execute();
    }
}
