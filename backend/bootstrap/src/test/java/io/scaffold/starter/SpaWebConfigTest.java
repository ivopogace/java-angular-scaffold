package io.scaffold.starter;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.RestController;

// Controllers are excluded so this slice needs none of any area's ports.
@WebMvcTest(excludeFilters = @Filter(type = FilterType.ANNOTATION, classes = RestController.class))
class SpaWebConfigTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void clientRouteIsAnsweredWithIndexHtml() throws Exception {
        mockMvc.perform(get("/catalog/new"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("spa-fixture")));
    }

    @Test
    void unknownApiPathIsAProblemNotTheSpa() throws Exception {
        mockMvc.perform(get("/api/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }
}
