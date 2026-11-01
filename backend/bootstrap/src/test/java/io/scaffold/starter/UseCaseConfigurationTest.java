package io.scaffold.starter;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

class UseCaseConfigurationTest {

    @Test
    void registersUseCaseClassesAndNothingElse() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.register(UseCaseConfiguration.class);
            // Only the registered definitions are under test; real use cases need collaborators this bare context lacks.
            context.addBeanFactoryPostProcessor((BeanFactoryPostProcessor) beanFactory -> {
                for (String name : beanFactory.getBeanDefinitionNames()) {
                    beanFactory.getBeanDefinition(name).setLazyInit(true);
                }
            });
            context.refresh();

            assertThat(context.containsBeanDefinition("probeUseCase")).isTrue();
            assertThat(context.containsBeanDefinition("plainProbeComponent")).isFalse();
        }
    }
}
