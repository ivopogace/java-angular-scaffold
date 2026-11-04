package io.scaffold.starter.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import io.scaffold.starter.TestcontainersConfiguration;
import io.scaffold.starter.catalog.application.port.in.CreateProduct;
import io.scaffold.starter.catalog.application.port.in.CreateProductCommand;
import io.scaffold.starter.catalog.application.port.in.ProductView;
import io.scaffold.starter.catalog.application.port.in.PublishOutcome;
import io.scaffold.starter.catalog.application.port.in.PublishProduct;
import io.scaffold.starter.catalog.application.port.out.ProductRepository;
import io.scaffold.starter.catalog.domain.event.ProductPublished;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.catalog.domain.model.Product;
import io.scaffold.starter.shared.Money;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.test.ApplicationModuleTest;

/**
 * Two publishes of one draft in separate transactions, both past their load before either updates: the row's
 * version lets exactly one write and publish {@link ProductPublished}.
 */
@ApplicationModuleTest
@Import({TestcontainersConfiguration.class, ConcurrentPublishIT.BothLoadFirstConfiguration.class})
@Tag("container")
class ConcurrentPublishIT {

    private static final int WRITERS = 2;
    private static final CyclicBarrier BOTH_LOADED = new CyclicBarrier(WRITERS);

    @Autowired
    CreateProduct createProduct;

    @Autowired
    PublishProduct publishProduct;

    @Autowired
    JdbcClient jdbc;

    @Test
    void twoConcurrentPublishesGiveOneSuccessAndOneEvent() throws Exception {
        ProductView draft = createProduct.create(new CreateProductCommand("Linen shirt", Money.of(4999, "EUR")));

        List<PublishOutcome> outcomes;
        try (ExecutorService writers = Executors.newFixedThreadPool(WRITERS)) {
            Future<PublishOutcome> first = writers.submit(() -> publishProduct.publish(draft.id()));
            Future<PublishOutcome> second = writers.submit(() -> publishProduct.publish(draft.id()));
            outcomes = List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
        }

        assertThat(outcomes).filteredOn(PublishOutcome.Published.class::isInstance).hasSize(1);
        assertThat(outcomes).filteredOn(PublishOutcome.ConcurrentChange.class::isInstance).hasSize(1);
        assertThat(publishedEvents(draft.id())).isEqualTo(1);
        assertThat(storedVersion(draft.id())).isEqualTo(1);
    }

    private long publishedEvents(ProductId id) {
        return jdbc.sql("""
                        select count(*) from event_publication
                        where event_type = :type and serialized_event like :product
                        """)
                .param("type", ProductPublished.class.getName())
                .param("product", "%" + id.value() + "%")
                .query(Long.class)
                .single();
    }

    private long storedVersion(ProductId id) {
        return jdbc.sql("select version from catalog_product where id = :id")
                .param("id", id.value())
                .query(Long.class)
                .single();
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class BothLoadFirstConfiguration {

        /** Holds each update until both publishes have loaded the draft, so neither sees the other's write. */
        @Bean
        @Primary
        ProductRepository bothLoadFirst(@Qualifier("jdbcProductRepository") ProductRepository jdbc) {
            return new ProductRepository() {
                @Override
                public void add(Product product) {
                    jdbc.add(product);
                }

                @Override
                public boolean update(Product product) {
                    try {
                        BOTH_LOADED.await(10, TimeUnit.SECONDS);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException(e);
                    } catch (BrokenBarrierException | TimeoutException e) {
                        throw new IllegalStateException("The other publish never reached its update", e);
                    }
                    return jdbc.update(product);
                }

                @Override
                public Optional<Product> findById(ProductId id) {
                    return jdbc.findById(id);
                }

                @Override
                public List<Product> findAll() {
                    return jdbc.findAll();
                }
            };
        }
    }
}
