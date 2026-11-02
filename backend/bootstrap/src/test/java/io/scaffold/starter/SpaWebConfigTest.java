package io.scaffold.starter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.HttpRequestHandler;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.handler.SimpleUrlHandlerMapping;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// Controllers are excluded so this slice needs none of any area's ports.
@WebMvcTest(excludeFilters = @Filter(type = FilterType.ANNOTATION, classes = RestController.class))
class SpaWebConfigTest {

    private static final Path ANGULAR_JSON = Path.of("../../frontend/angular.json");

    @Autowired
    MockMvc mockMvc;

    /** A handler outside {@code /api}, as a login page or API docs would be. */
    @TestConfiguration
    static class ProbeHandler {
        @Bean
        SimpleUrlHandlerMapping probeMapping() {
            HttpRequestHandler probe = (request, response) -> response.getWriter().write("probe");
            SimpleUrlHandlerMapping mapping =
                    new SimpleUrlHandlerMapping(Map.of("/probe/**", probe));
            mapping.setOrder(0);
            return mapping;
        }
    }

    @ParameterizedTest
    @CsvSource({
        "/de/catalog/new, spa-fixture-de",
        "/en/catalog/new, spa-fixture-en",
        "/de/api/x, spa-fixture-de",
    })
    void clientRouteGetsItsLocalesIndexHtml(String path, String fixture) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString(fixture)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"de", "en"})
    void aLocalesRootIsForwardedToItsShell(String locale) throws Exception {
        mockMvc.perform(get("/" + locale + "/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/" + locale + "/index.html"));
    }

    @Test
    void aMissingFileInsideALocaleIsNotFoundRatherThanTheShell() throws Exception {
        mockMvc.perform(get("/en/missing.js")).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @CsvSource(
            delimiter = '|',
            value = {
                "/                  | /de/",
                "/catalog/new       | /de/catalog/new",
                "/apix              | /de/apix",
                "/actuators         | /de/actuators",
                "/main-F1XTURE.js   | /de/main-F1XTURE.js",
                "/english/page      | /de/english/page",
            })
    void aPathWithoutALocaleGoesToTheGermanBuild(String path, String target) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isFound())
                .andExpect(redirectedUrl(target))
                .andExpect(header().string(HttpHeaders.VARY, HttpHeaders.ACCEPT_LANGUAGE));
    }

    @ParameterizedTest
    @ValueSource(strings = {"de", "en"})
    void aBareLocalePrefixRedirectsToItsBaseHref(String locale) throws Exception {
        mockMvc.perform(get("/" + locale).queryParam("page", "2"))
                .andExpect(status().isFound())
                .andExpect(redirectedUrl("/" + locale + "/?page=2"));
    }

    @Test
    void theRedirectKeepsTheQuery() throws Exception {
        mockMvc.perform(get("/catalog").queryParam("page", "2"))
                .andExpect(redirectedUrl("/de/catalog?page=2"));
    }

    @Test
    void headIsRedirectedLikeGet() throws Exception {
        mockMvc.perform(head("/catalog")).andExpect(redirectedUrl("/de/catalog"));
    }

    @Test
    void anUnansweredPostIsAProblemNotARedirect() throws Exception {
        mockMvc.perform(post("/catalog"))
                .andExpect(status().isNotFound())
                .andExpect(header().doesNotExist(HttpHeaders.LOCATION))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void aPathAnotherHandlerAnswersIsNotRedirected() throws Exception {
        mockMvc.perform(get("/probe/page"))
                .andExpect(status().isOk())
                .andExpect(content().string("probe"));
    }

    @Test
    void theLocalesAreThoseAngularBuilds() throws Exception {
        JsonNode i18n = JsonMapper.builder().build()
                .readTree(ANGULAR_JSON.toFile())
                .get("projects").properties().iterator().next().getValue()
                .get("i18n");
        List<String> built = new ArrayList<>(List.of(i18n.get("sourceLocale").asString()));
        i18n.get("locales").properties().forEach(locale -> built.add(locale.getKey()));
        assertThat(SpaWebConfig.LOCALES).containsExactlyInAnyOrderElementsOf(built);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "en", "en-US", "en-GB,en;q=0.9,de;q=0.8", "fr,en;q=0.5", "de;q=0.4,en;q=0.9",
    })
    void anEnglishPreferenceGoesToTheEnglishBuild(String acceptLanguage) throws Exception {
        mockMvc.perform(get("/catalog").header(HttpHeaders.ACCEPT_LANGUAGE, acceptLanguage))
                .andExpect(status().isFound())
                .andExpect(redirectedUrl("/en/catalog"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "de", "de-AT,en;q=0.5", "en;q=0.5,de", "fr", "*", "en;q=0", "not a header;;",
    })
    void anyOtherPreferenceGoesToTheGermanBuild(String acceptLanguage) throws Exception {
        mockMvc.perform(get("/").header(HttpHeaders.ACCEPT_LANGUAGE, acceptLanguage))
                .andExpect(status().isFound())
                .andExpect(redirectedUrl("/de/"));
    }

    @Test
    void preferredLocaleDefaultsToGermanWithoutAHeader() {
        assertThat(SpaWebConfig.preferredLocale(null)).isEqualTo("de");
        assertThat(SpaWebConfig.preferredLocale(" ")).isEqualTo("de");
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "/api/does-not-exist", "/api", "/actuator", "/api/", "/actuator/",
        "/api;jsessionid=abc/does-not-exist",
    })
    void apiAndActuatorPathsAreProblemsNotTheSpa(String path) throws Exception {
        mockMvc.perform(get(path).header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isNotFound())
                .andExpect(header().doesNotExist(HttpHeaders.LOCATION))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void anEncodedApiPathIsJudgedDecoded() throws Exception {
        mockMvc.perform(get(URI.create("/%61pi/does-not-exist")))
                .andExpect(status().isNotFound())
                .andExpect(header().doesNotExist(HttpHeaders.LOCATION));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/de/index.html", "/de/catalog/new", "/en/catalog/new"})
    void theShellIsNeverServedFromCache(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("spa-fixture")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-cache"));
    }

    @Test
    void anUnhashedFileIsPartOfTheShell() throws Exception {
        mockMvc.perform(get("/de/unhashed.js"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-cache"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/de/main-F1XTURE.js", "/de/media/logo-F1XTURE.svg"})
    void hashedAssetsAreCachedForAYear(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=31536000, immutable"));
    }
}
