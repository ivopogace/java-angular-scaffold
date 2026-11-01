package io.scaffold.starter;

import java.io.IOException;
import java.time.Duration;
import java.util.regex.Pattern;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the built Angular app from the same origin. A GET for a path that is not a file (no
 * {@code .}) and not {@code /api} or {@code /actuator} or below them answers with
 * {@code index.html}, so client-side routes survive a reload; unknown API paths still end in a
 * 404 problem body. The shell ({@code index.html}, the fallback, anything unhashed) is served with
 * {@code Cache-Control: no-cache}, so a deploy is picked up on the next load; scripts, styles and
 * media whose name carries a content hash ({@code main-ABC123.js}, as Angular's production
 * {@code outputHashing} names them) are cached for a year as immutable.
 */
@Configuration(proxyBeanMethods = false)
class SpaWebConfig implements WebMvcConfigurer {

    private static final String STATIC_LOCATION = "classpath:/static/";
    private static final String MEDIA = "media/";
    private static final String[] HASHED_ASSETS = {"/*-*.js", "/*-*.css"};
    private static final String HASHED_MEDIA = "/" + MEDIA + "*-*.*";
    private static final CacheControl HASHED = CacheControl.maxAge(Duration.ofDays(365)).immutable();
    private static final CacheControl SHELL = CacheControl.noCache();
    private static final Resource INDEX = new ClassPathResource("static/index.html");
    private static final Pattern RESERVED = Pattern.compile("(api|actuator)(/.*)?");

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(HASHED_ASSETS)
                .addResourceLocations(STATIC_LOCATION)
                .setCacheControl(HASHED);
        // A handler resolves the path below its literal prefix, so media needs its own root.
        registry.addResourceHandler(HASHED_MEDIA)
                .addResourceLocations(STATIC_LOCATION + MEDIA)
                .setCacheControl(HASHED);
        registry.addResourceHandler("/**")
                .addResourceLocations(STATIC_LOCATION)
                .setCacheControl(SHELL)
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
            return !path.contains(".") && !RESERVED.matcher(path).matches();
        }
    }
}
