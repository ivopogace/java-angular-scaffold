package io.scaffold.starter.catalog.adapter.out.persistence;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

interface PublicationLogRows extends Repository<PublicationLogRow, UUID> {

    /** Atomic: a concurrent or repeated append of the same id inserts nothing. */
    @Modifying
    @Query("""
            insert into catalog_publication_log (product_id, published_at)
            values (:productId, :publishedAt)
            on conflict do nothing
            """)
    void insertIfAbsent(@Param("productId") UUID productId, @Param("publishedAt") Instant publishedAt);
}
