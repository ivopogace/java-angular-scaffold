package io.scaffold.starter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.jooq.impl.DSL.table;

import java.time.Clock;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Tag("container")
class ApplicationIT {

    @Autowired
    Clock clock;

    @Autowired
    ZoneId businessTimeZone;

    @Autowired
    DSLContext dsl;

    @Test
    void bootsWithUtcClockAndConfiguredZone() {
        assertThat(clock.getZone()).isEqualTo(ZoneOffset.UTC);
        assertThat(businessTimeZone).isEqualTo(ZoneId.of("UTC"));
    }

    @Test
    void flywayCreatedTheEventPublicationTable() {
        assertThat(dsl.fetchCount(table("event_publication"))).isZero();
    }
}
