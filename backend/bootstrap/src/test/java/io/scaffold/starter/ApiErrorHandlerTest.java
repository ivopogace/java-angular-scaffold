package io.scaffold.starter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// Controllers are excluded so this slice needs none of any area's ports.
@WebMvcTest(excludeFilters = @Filter(type = FilterType.ANNOTATION, classes = RestController.class))
@Import(ApiErrorHandlerTest.ExplodingController.class)
class ApiErrorHandlerTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void unexpectedExceptionBecomesAGenericProblemWithoutLeakingDetail() throws Exception {
        String body = mockMvc.perform(get("/api/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Internal error"))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("secret detail");
    }

    @RestController
    static class ExplodingController {

        @GetMapping("/api/boom")
        String boom() {
            throw new IllegalStateException("secret detail");
        }
    }
}
