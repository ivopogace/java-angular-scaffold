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

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.RestController;

// Controllers are excluded so this slice needs none of any area's ports.
@WebMvcTest(excludeFilters = @Filter(type = FilterType.ANNOTATION, classes = RestController.class))
class SpaWebConfigTest {

    @Autowired
    MockMvc mockMvc;

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
                "/de                | /de/",
                "/en                | /en/",
                "/english/page      | /de/english/page",
            })
    void aPathWithoutALocaleGoesToTheGermanBuild(String path, String target) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isFound())
                .andExpect(redirectedUrl(target))
                .andExpect(header().string(HttpHeaders.VARY, HttpHeaders.ACCEPT_LANGUAGE));
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
    void aPostWithoutALocaleIsNotRedirected() throws Exception {
        mockMvc.perform(post("/catalog")).andExpect(header().doesNotExist(HttpHeaders.LOCATION));
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
    @ValueSource(strings = {"/api/does-not-exist", "/api", "/actuator", "/api/", "/actuator/"})
    void apiAndActuatorPathsAreProblemsNotTheSpa(String path) throws Exception {
        mockMvc.perform(get(path).header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isNotFound())
                .andExpect(header().doesNotExist(HttpHeaders.LOCATION))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
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
