package io.scaffold.starter;

import io.scaffold.starter.shared.UseCase;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;

/** Registers every {@link UseCase}-annotated class as a bean, keeping {@code application-core} free of Spring. */
@Configuration(proxyBeanMethods = false)
@ComponentScan(
        basePackageClasses = Application.class,
        useDefaultFilters = false,
        includeFilters = @Filter(type = FilterType.ANNOTATION, classes = UseCase.class))
class UseCaseConfiguration {
}
