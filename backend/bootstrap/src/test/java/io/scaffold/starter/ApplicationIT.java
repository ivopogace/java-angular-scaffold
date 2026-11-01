package io.scaffold.starter;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Tag("container")
class ApplicationIT {

    @Autowired
    Clock clock;

    @Autowired
    ZoneId businessTimeZone;

    @Autowired
    JdbcClient jdbc;

    @Test
    void bootsWithUtcClockAndConfiguredZone() {
        assertThat(clock.getZone()).isEqualTo(ZoneOffset.UTC);
        assertThat(businessTimeZone).isEqualTo(ZoneId.of("UTC"));
    }

    @Test
    void flywayCreatedTheEventPublicationTable() {
        assertThat(jdbc.sql("select count(*) from event_publication").query(Long.class).single()).isZero();
    }
}
