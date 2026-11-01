package io.scaffold.starter;

import io.scaffold.starter.shared.DomainEventPublisher;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Hands domain events to Spring's publisher so Spring Modulith's event publication registry sees them. */
@Configuration(proxyBeanMethods = false)
class DomainEventPublisherConfiguration {

    @Bean
    DomainEventPublisher domainEventPublisher(ApplicationEventPublisher publisher) {
        return publisher::publishEvent;
    }
}
