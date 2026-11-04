package io.scaffold.starter;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/** Runs compose.yaml's Postgres image, which the Gradle build passes as {@value #IMAGE_PROPERTY}. */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    static final String IMAGE_PROPERTY = "postgres.image";

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        String image = System.getProperty(IMAGE_PROPERTY);
        if (image == null || image.isBlank()) {
            throw new IllegalStateException("No Postgres image: run the tests through Gradle, which passes "
                    + "compose.yaml's image as -D" + IMAGE_PROPERTY);
        }
        return new PostgreSQLContainer(DockerImageName.parse(image).asCompatibleSubstituteFor("postgres"));
    }
}
