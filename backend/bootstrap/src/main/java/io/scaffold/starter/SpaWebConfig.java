package io.scaffold.starter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.web.HttpRequestHandler;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.handler.AbstractHandlerMapping;
import org.springframework.web.servlet.resource.PathResourceResolver;
import org.springframework.web.util.UrlPathHelper;

/**
 * Serves the built Angular app from the same origin, one build per locale: {@code /de/…} from
 * {@code static/de/}, {@code /en/…} from {@code static/en/} (the locales of the {@code i18n}
 * block in {@code angular.json}; {@code SpaWebConfigTest} fails when the two differ). Inside a
 * locale, a GET for a path that is not a file (no {@code .}) answers with that locale's
 * {@code index.html}, so client-side routes survive a reload. A GET or HEAD that no controller,
 * resource or locale build answers, outside {@code /api} and {@code /actuator}, is redirected to
 * the same path under the locale {@code Accept-Language} prefers: {@code de} unless it prefers
 * {@code en}. Everything else unmatched, unknown API paths included, ends in a 404 problem body.
 * Spring Boot's own static mappings are off ({@code spring.web.resources.add-mappings}), so these
 * are the only ones. The shell ({@code index.html}, the fallback, anything unhashed) is served
 * with {@code Cache-Control: no-cache}, so a deploy is picked up on the next load; scripts,
 * styles and media whose name carries a content hash ({@code main-ABC123.js}, as Angular's
 * production {@code outputHashing} names them) are cached for a year as immutable.
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
    private static final Pattern RESERVED = Pattern.compile("/(api|actuator)(/.*)?");

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

    /**
     * A resource handler never resolves the empty path below its prefix: a locale's root forwards
     * to its shell, and the bare prefix redirects to the root, its base href.
     */
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        for (String locale : LOCALES) {
            registry.addViewController("/" + locale + "/")
                    .setViewName("forward:/" + locale + "/index.html");
            registry.addRedirectViewController("/" + locale, "/" + locale + "/")
                    .setKeepQueryParams(true)
                    .setStatusCode(HttpStatus.FOUND);
        }
    }

    @Bean
    HandlerMapping localeRedirectMapping() {
        return new LocaleRedirectMapping();
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
     * Consulted after every other mapping, so only a request nothing else answers reaches it. It
     * takes a GET or HEAD outside {@code /api} and {@code /actuator} (judged on the decoded path
     * without path parameters, as the other mappings judge it) and leaves everything else
     * unhandled, which ends in a 404 problem body.
     */
    private static final class LocaleRedirectMapping extends AbstractHandlerMapping {

        private static final HttpRequestHandler REDIRECT = LocaleRedirectMapping::redirect;

        LocaleRedirectMapping() {
            setOrder(Ordered.LOWEST_PRECEDENCE);
        }

        @Override
        protected Object getHandlerInternal(HttpServletRequest request) {
            String method = request.getMethod();
            boolean page = HttpMethod.GET.matches(method) || HttpMethod.HEAD.matches(method);
            String lookupPath = UrlPathHelper.defaultInstance.getLookupPathForRequest(request);
            return page && !RESERVED.matcher(lookupPath).matches() ? REDIRECT : null;
        }

        /** Sends the request to the preferred locale's build, with its path and query. */
        private static void redirect(HttpServletRequest request, HttpServletResponse response) {
            String path = request.getRequestURI().substring(request.getContextPath().length());
            String query = request.getQueryString();
            String locale = preferredLocale(request.getHeader(HttpHeaders.ACCEPT_LANGUAGE));
            response.setStatus(HttpStatus.FOUND.value());
            response.setHeader(HttpHeaders.VARY, HttpHeaders.ACCEPT_LANGUAGE);
            response.setHeader(
                    HttpHeaders.LOCATION,
                    request.getContextPath() + "/" + locale + path
                            + (query == null ? "" : "?" + query));
        }
    }
}
