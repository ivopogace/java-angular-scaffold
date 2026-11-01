package io.scaffold.starter;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
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
    @ValueSource(strings = {"/catalog/new", "/apix", "/actuators"})
    void clientRouteIsAnsweredWithIndexHtml(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("spa-fixture")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/does-not-exist", "/api", "/actuator", "/api/", "/actuator/"})
    void apiAndActuatorPathsAreProblemsNotTheSpa(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void theRootIsForwardedToTheShell() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("index.html"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/index.html", "/catalog/new"})
    void theShellIsNeverServedFromCache(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("spa-fixture")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-cache"));
    }

    @Test
    void anUnhashedFileIsPartOfTheShell() throws Exception {
        mockMvc.perform(get("/unhashed.js"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-cache"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/main-F1XTURE.js", "/media/logo-F1XTURE.svg"})
    void hashedAssetsAreCachedForAYear(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=31536000, immutable"));
    }
}
