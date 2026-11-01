package io.scaffold.starter.catalog.application.service;

import io.scaffold.starter.catalog.application.port.in.RecordProductPublication;
import io.scaffold.starter.catalog.application.port.out.PublicationLog;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.shared.UseCase;
import jakarta.transaction.Transactional;
import java.time.Instant;

@UseCase
class PublicationRecorder implements RecordProductPublication {

    private final PublicationLog log;

    PublicationRecorder(PublicationLog log) {
        this.log = log;
    }

    @Override
    @Transactional
    public void record(ProductId id, Instant publishedAt) {
        log.append(id, publishedAt);
    }
}
