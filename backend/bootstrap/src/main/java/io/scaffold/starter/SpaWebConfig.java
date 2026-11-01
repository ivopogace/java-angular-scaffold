package io.scaffold.starter;

import java.io.IOException;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the built Angular app from the same origin. A GET for a path that is not a file (no
 * {@code .}) and not under {@code /api/} or {@code /actuator/} answers with {@code index.html},
 * so client-side routes survive a reload; unknown API paths still end in a 404 problem body.
 */
@Configuration(proxyBeanMethods = false)
class SpaWebConfig implements WebMvcConfigurer {

    private static final String STATIC_LOCATION = "classpath:/static/";
    private static final Resource INDEX = new ClassPathResource("static/index.html");

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations(STATIC_LOCATION)
                .resourceChain(true)
                .addResolver(new SpaFallbackResolver());
    }

    private static final class SpaFallbackResolver extends PathResourceResolver {

        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = super.getResource(resourcePath, location);
            if (requested != null || !isClientRoute(resourcePath) || !INDEX.exists()) {
                return requested;
            }
            return INDEX;
        }

        private static boolean isClientRoute(String path) {
            return !path.contains(".") && !path.startsWith("api/") && !path.startsWith("actuator/");
        }
    }
}
