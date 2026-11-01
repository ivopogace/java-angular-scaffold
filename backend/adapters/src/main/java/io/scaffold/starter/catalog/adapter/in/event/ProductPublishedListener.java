package io.scaffold.starter.catalog.adapter.in.event;

import io.scaffold.starter.catalog.application.port.in.RecordProductPublication;
import io.scaffold.starter.catalog.domain.event.ProductPublished;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
class ProductPublishedListener {

    private final RecordProductPublication recordPublication;

    ProductPublishedListener(RecordProductPublication recordPublication) {
        this.recordPublication = recordPublication;
    }

    @ApplicationModuleListener
    void on(ProductPublished event) {
        recordPublication.record(event.productId(), event.publishedAt());
    }
}
