package io.scaffold.starter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the built Angular app from the same origin, one build per locale: {@code /de/…} from
 * {@code static/de/}, {@code /en/…} from {@code static/en/} (the locales of {@code angular.json}'s
 * {@code i18n} block). Inside a locale, a GET for a path that is not a file (no {@code .}) answers
 * with that locale's {@code index.html}, so client-side routes survive a reload. A GET or HEAD for
 * any other path except {@code /api}, {@code /actuator} and {@code /error} (and below them) is
 * redirected to the same path under the locale {@code Accept-Language} prefers, {@code de} unless
 * it prefers {@code en}; unknown API paths still end in a 404 problem body. The shell
 * ({@code index.html}, the fallback, anything unhashed) is served with {@code Cache-Control:
 * no-cache}, so a deploy is picked up on the next load; scripts, styles and media whose name carries
 * a content hash ({@code main-ABC123.js}, as Angular's production {@code outputHashing} names them)
 * are cached for a year as immutable.
 */
@Configuration(proxyBeanMethods = false)
class SpaWebConfig implements WebMvcConfigurer {

    static final String DEFAULT_LOCALE = "de";
    static final List<String> LOCALES = List.of(DEFAULT_LOCALE, "en");

    private static final String STATIC_ROOT = "static/";
    private static final String MEDIA = "media/";
    private static final String[] HASHED_ASSETS = {"*-*.js", "*-*.css"};
    private static final String HASHED_MEDIA = MEDIA + "*-*.*";
    private static final CacheControl HASHED = CacheControl.maxAge(Duration.ofDays(365)).immutable();
    private static final CacheControl SHELL = CacheControl.noCache();
    private static final Pattern RESERVED = Pattern.compile("/(api|actuator|error)(/.*)?");

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        for (String locale : LOCALES) {
            String prefix = "/" + locale + "/";
            String location = "classpath:/" + STATIC_ROOT + locale + "/";
            for (String hashed : HASHED_ASSETS) {
                registry.addResourceHandler(prefix + hashed)
                        .addResourceLocations(location)
                        .setCacheControl(HASHED);
            }
            // A handler resolves the path below its literal prefix, so media needs its own root.
            registry.addResourceHandler(prefix + HASHED_MEDIA)
                    .addResourceLocations(location + MEDIA)
                    .setCacheControl(HASHED);
            registry.addResourceHandler(prefix + "**")
                    .addResourceLocations(location)
                    .setCacheControl(SHELL)
                    .resourceChain(true)
                    .addResolver(new SpaFallbackResolver(
                            new ClassPathResource(STATIC_ROOT + locale + "/index.html")));
        }
    }

    @Bean
    OncePerRequestFilter localeRedirectFilter() {
        return new LocaleRedirectFilter();
    }

    /** The supported locale {@code Accept-Language} prefers most, else {@link #DEFAULT_LOCALE}. */
    static String preferredLocale(String acceptLanguage) {
        if (acceptLanguage == null || acceptLanguage.isBlank()) {
            return DEFAULT_LOCALE;
        }
        try {
            String tag = Locale.lookupTag(Locale.LanguageRange.parse(acceptLanguage), LOCALES);
            return tag == null ? DEFAULT_LOCALE : tag;
        } catch (IllegalArgumentException _) {
            return DEFAULT_LOCALE;
        }
    }

    private static final class SpaFallbackResolver extends PathResourceResolver {

        private final Resource index;

        SpaFallbackResolver(Resource index) {
            this.index = index;
        }

        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = super.getResource(resourcePath, location);
            if (requested != null || resourcePath.contains(".") || !index.exists()) {
                return requested;
            }
            return index;
        }
    }

    /**
     * Sends a page request without a locale prefix to the preferred locale's build, keeping path
     * and query; {@code /de} becomes {@code /de/}, the base href of that build.
     */
    private static final class LocaleRedirectFilter extends OncePerRequestFilter {

        @Override
        protected boolean shouldNotFilter(HttpServletRequest request) {
            String method = request.getMethod();
            if (!HttpMethod.GET.matches(method) && !HttpMethod.HEAD.matches(method)) {
                return true;
            }
            String path = pathOf(request);
            return RESERVED.matcher(path).matches()
                    || LOCALES.stream().anyMatch(locale -> path.startsWith("/" + locale + "/"));
        }

        @Override
        protected void doFilterInternal(
                HttpServletRequest request, HttpServletResponse response, FilterChain chain) {
            String path = pathOf(request);
            String target = LOCALES.contains(path.substring(1))
                    ? path + "/"
                    : "/" + preferredLocale(request.getHeader(HttpHeaders.ACCEPT_LANGUAGE)) + path;
            String query = request.getQueryString();
            response.setStatus(HttpStatus.FOUND.value());
            response.setHeader(HttpHeaders.VARY, HttpHeaders.ACCEPT_LANGUAGE);
            response.setHeader(
                    HttpHeaders.LOCATION,
                    request.getContextPath() + target + (query == null ? "" : "?" + query));
        }

        private static String pathOf(HttpServletRequest request) {
            String path = request.getRequestURI().substring(request.getContextPath().length());
            return path.isEmpty() ? "/" : path;
        }
    }
}
