package io.scaffold.starter.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import io.scaffold.starter.TestcontainersConfiguration;
import io.scaffold.starter.catalog.domain.event.ProductPublished;
import io.scaffold.starter.catalog.domain.id.ProductId;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.test.EnableScenarios;
import org.springframework.modulith.test.Scenario;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@EnableScenarios
@Import(TestcontainersConfiguration.class)
@Tag("container")
class CatalogFlowIT {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @Test
    void createPublishRetireThroughTheRestApiRecordsThePublication(Scenario scenario) throws Exception {
        String body = mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Linen shirt", "priceMinor": 4999, "currency": "EUR"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.state").value("DRAFT"))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        ProductId productId = new ProductId(UUID.fromString(id));

        scenario.stimulate(() -> publish(id))
                .andWaitForStateChange(() -> loggedPublications(id), count -> count == 1)
                .andVerifyEvents(events -> assertThat(events.ofType(ProductPublished.class))
                        .extracting(ProductPublished::productId)
                        .contains(productId));

        mockMvc.perform(post("/api/catalog/products/{id}/retire", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("RETIRED"));
        mockMvc.perform(get("/api/catalog/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '%s')].state".formatted(id)).value("RETIRED"));
    }

    private long loggedPublications(String productId) {
        return jdbc.sql("select count(*) from catalog_publication_log where product_id = :id")
                .param("id", UUID.fromString(productId))
                .query(Long.class)
                .single();
    }

    private void publish(String id) {
        try {
            mockMvc.perform(post("/api/catalog/products/{id}/publish", id))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.state").value("PUBLISHED"));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
