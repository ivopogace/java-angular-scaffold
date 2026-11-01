package io.scaffold.starter;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

class UseCaseConfigurationTest {

    @Test
    void registersUseCaseClassesAndNothingElse() {
        try (var context = new AnnotationConfigApplicationContext(UseCaseConfiguration.class)) {
            assertThat(context.getBeansOfType(ProbeUseCase.class)).hasSize(1);
            assertThat(context.getBeansOfType(PlainProbeComponent.class)).isEmpty();
        }
    }
}
