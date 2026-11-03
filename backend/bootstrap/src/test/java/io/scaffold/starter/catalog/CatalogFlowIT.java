package io.scaffold.starter.catalog;

import static io.scaffold.starter.catalog.adapter.out.persistence.jooq.Tables.CATALOG_PUBLICATION_LOG;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import io.scaffold.starter.TestcontainersConfiguration;
import java.net.URI;
import io.scaffold.starter.catalog.domain.event.ProductPublished;
import io.scaffold.starter.catalog.domain.id.ProductId;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.modulith.test.Scenario;
import org.springframework.test.web.servlet.MockMvc;

@ApplicationModuleTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Tag("container")
class CatalogFlowIT {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    @Test
    void createPublishRetireThroughTheRestApiRecordsThePublication(Scenario scenario) throws Exception {
        MockHttpServletResponse created = mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Linen shirt", "priceMinor": 4999, "currency": "EUR"}"""))
                .andExpect(status().isCreated())
                .andExpect(header().exists(HttpHeaders.LOCATION))
                .andExpect(jsonPath("$.state").value("DRAFT"))
                .andReturn().getResponse();
        String id = JsonPath.read(created.getContentAsString(), "$.id");
        ProductId productId = new ProductId(UUID.fromString(id));

        mockMvc.perform(get(URI.create(created.getHeader(HttpHeaders.LOCATION))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.state").value("DRAFT"));

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

    private int loggedPublications(String productId) {
        return dsl.fetchCount(CATALOG_PUBLICATION_LOG, CATALOG_PUBLICATION_LOG.PRODUCT_ID.eq(UUID.fromString(productId)));
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
