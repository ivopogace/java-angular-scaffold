package io.scaffold.starter.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.scaffold.starter.TestcontainersConfiguration;
import io.scaffold.starter.catalog.application.port.in.CreateProduct;
import io.scaffold.starter.catalog.application.port.in.CreateProductCommand;
import io.scaffold.starter.catalog.application.port.in.ProductView;
import io.scaffold.starter.catalog.application.port.in.PublishProduct;
import io.scaffold.starter.shared.DomainEventPublisher;
import io.scaffold.starter.shared.Money;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.test.ApplicationModuleTest;

/** {@code jakarta.transaction.Transactional} on a {@code @UseCase} bean rolls back when publishing fails. */
@ApplicationModuleTest
@Import({TestcontainersConfiguration.class, PublishRollbackIT.FailingPublisherConfiguration.class})
@Tag("container")
class PublishRollbackIT {

    @Autowired
    CreateProduct createProduct;

    @Autowired
    PublishProduct publishProduct;

    @Autowired
    JdbcClient jdbc;

    @Test
    void aFailureAfterTheSaveRollsThePublishBack() {
        ProductView draft = createProduct.create(new CreateProductCommand("Linen shirt", Money.of(4999, "EUR")));

        assertThatThrownBy(() -> publishProduct.publish(draft.id()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("event bus down");

        String status = jdbc.sql("select status from catalog_product where id = :id")
                .param("id", draft.id().value())
                .query(String.class)
                .single();
        assertThat(status).isEqualTo("DRAFT");
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FailingPublisherConfiguration {

        @Bean
        @Primary
        DomainEventPublisher failingDomainEventPublisher() {
            return event -> {
                throw new IllegalStateException("event bus down");
            };
        }
    }
}
