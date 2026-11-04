package io.scaffold.starter.catalog.adapter.out.persistence;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("catalog_publication_log")
record PublicationLogRow(@Id UUID productId, Instant publishedAt) {}
