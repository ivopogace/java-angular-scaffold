package io.scaffold.starter.catalog.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.scaffold.starter.catalog.application.port.in.CreateProduct;
import io.scaffold.starter.catalog.application.port.in.CreateProductCommand;
import io.scaffold.starter.catalog.application.port.in.FindProduct;
import io.scaffold.starter.catalog.application.port.in.ListProducts;
import io.scaffold.starter.catalog.application.port.in.ProductState;
import io.scaffold.starter.catalog.application.port.in.ProductView;
import io.scaffold.starter.catalog.application.port.in.PublishOutcome;
import io.scaffold.starter.catalog.application.port.in.PublishProduct;
import io.scaffold.starter.catalog.application.port.in.RetireOutcome;
import io.scaffold.starter.catalog.application.port.in.RetireProduct;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.shared.Money;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ProductController.class)
class ProductControllerTest {

    private static final ProductId ID = ProductId.newId();
    private static final Instant PUBLISHED_AT = Instant.parse("2026-11-01T10:00:00Z");

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    CreateProduct createProduct;

    @MockitoBean
    PublishProduct publishProduct;

    @MockitoBean
    RetireProduct retireProduct;

    @MockitoBean
    ListProducts listProducts;

    @MockitoBean
    FindProduct findProduct;

    @Test
    void listReturnsEveryProduct() throws Exception {
        when(listProducts.list()).thenReturn(List.of(
                view(ProductState.PUBLISHED, Money.of(4999, "EUR"), PUBLISHED_AT),
                view(ProductState.DRAFT, null, null)));

        mockMvc.perform(get("/api/catalog/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(ID.value().toString()))
                .andExpect(jsonPath("$[0].priceMinor").value(4999))
                .andExpect(jsonPath("$[0].currency").value("EUR"))
                .andExpect(jsonPath("$[0].state").value("PUBLISHED"))
                .andExpect(jsonPath("$[0].publishedAt").value("2026-11-01T10:00:00Z"))
                .andExpect(jsonPath("$[1].priceMinor").doesNotExist())
                .andExpect(jsonPath("$[1].state").value("DRAFT"));
    }

    @Test
    void getReturnsTheProduct() throws Exception {
        when(findProduct.find(ID))
                .thenReturn(Optional.of(view(ProductState.PUBLISHED, Money.of(4999, "EUR"), PUBLISHED_AT)));

        mockMvc.perform(get("/api/catalog/products/{id}", ID.value()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ID.value().toString()))
                .andExpect(jsonPath("$.name").value("Linen shirt"))
                .andExpect(jsonPath("$.priceMinor").value(4999))
                .andExpect(jsonPath("$.currency").value("EUR"))
                .andExpect(jsonPath("$.state").value("PUBLISHED"))
                .andExpect(jsonPath("$.publishedAt").value("2026-11-01T10:00:00Z"));
    }

    @Test
    void getOfAnUnknownProductIs404() throws Exception {
        when(findProduct.find(ID)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/catalog/products/{id}", ID.value()))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        verify(findProduct).find(ID);
    }

    @Test
    void getWithAMalformedIdIs400() throws Exception {
        mockMvc.perform(get("/api/catalog/products/not-a-uuid"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(findProduct);
    }

    @Test
    void createReturns201WithLocationAndBody() throws Exception {
        when(createProduct.create(any())).thenReturn(view(ProductState.DRAFT, Money.of(4999, "EUR"), null));

        mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Linen shirt", "priceMinor": 4999, "currency": "EUR"}"""))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "http://localhost/api/catalog/products/" + ID.value()))
                .andExpect(jsonPath("$.id").value(ID.value().toString()))
                .andExpect(jsonPath("$.state").value("DRAFT"));

        ArgumentCaptor<CreateProductCommand> command = ArgumentCaptor.forClass(CreateProductCommand.class);
        verify(createProduct).create(command.capture());
        assertThat(command.getValue()).isEqualTo(new CreateProductCommand("Linen shirt", Money.of(4999, "EUR")));
    }

    @Test
    void createWithoutPriceIsAllowed() throws Exception {
        when(createProduct.create(any())).thenReturn(view(ProductState.DRAFT, null, null));

        mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Mystery box"}"""))
                .andExpect(status().isCreated());

        ArgumentCaptor<CreateProductCommand> command = ArgumentCaptor.forClass(CreateProductCommand.class);
        verify(createProduct).create(command.capture());
        assertThat(command.getValue().price()).isNull();
    }

    @Test
    void createWithABlankNameIsRejected() throws Exception {
        mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "  "}"""))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        verifyNoInteractions(createProduct);
    }

    @Test
    void createWithANameOfUnicodeWhitespaceIsRejected() throws Exception {
        mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "\u2003\u2003"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        verifyNoInteractions(createProduct);
    }

    @Test
    void createStripsTheNameBeforeJudgingItsLength() throws Exception {
        when(createProduct.create(any())).thenReturn(view(ProductState.DRAFT, null, null));
        String longestName = "x".repeat(120);

        mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "  %s  "}""".formatted(longestName)))
                .andExpect(status().isCreated());

        ArgumentCaptor<CreateProductCommand> command = ArgumentCaptor.forClass(CreateProductCommand.class);
        verify(createProduct).create(command.capture());
        assertThat(command.getValue().name()).isEqualTo(longestName);
    }

    @Test
    void createWithAPriceButNoCurrencyIsRejected() throws Exception {
        mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Linen shirt", "priceMinor": 4999}"""))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(createProduct);
    }

    @Test
    void createWithACurrencyButNoPriceIsRejected() throws Exception {
        mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Linen shirt", "currency": "EUR"}"""))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(createProduct);
    }

    @Test
    void createWithANegativePriceOrMalformedCurrencyIsRejected() throws Exception {
        mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Linen shirt", "priceMinor": -1, "currency": "EUR"}"""))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Linen shirt", "priceMinor": 1, "currency": "eur"}"""))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(createProduct);
    }

    @Test
    void createWithAnUnknownCurrencyCodeIsRejected() throws Exception {
        mockMvc.perform(post("/api/catalog/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Linen shirt", "priceMinor": 1, "currency": "ZZZ"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        verifyNoInteractions(createProduct);
    }

    @Test
    void publishReturns200WithThePublishedProduct() throws Exception {
        when(publishProduct.publish(ID)).thenReturn(
                new PublishOutcome.Published(view(ProductState.PUBLISHED, Money.of(4999, "EUR"), PUBLISHED_AT)));

        mockMvc.perform(post("/api/catalog/products/{id}/publish", ID.value()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("PUBLISHED"));
    }

    @Test
    void publishOfAnUnknownProductIs404() throws Exception {
        when(publishProduct.publish(ID)).thenReturn(new PublishOutcome.NotFound());

        mockMvc.perform(post("/api/catalog/products/{id}/publish", ID.value()))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void publishOfAProductWithoutAPriceIs409WithTheReason() throws Exception {
        when(publishProduct.publish(ID)).thenReturn(new PublishOutcome.Rejected(PublishOutcome.Reason.NO_PRICE));

        mockMvc.perform(post("/api/catalog/products/{id}/publish", ID.value()))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.reason").value("NO_PRICE"));
    }

    @Test
    void publishOfANonDraftProductIs409WithTheReason() throws Exception {
        when(publishProduct.publish(ID)).thenReturn(new PublishOutcome.Rejected(PublishOutcome.Reason.NOT_DRAFT));

        mockMvc.perform(post("/api/catalog/products/{id}/publish", ID.value()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.reason").value("NOT_DRAFT"));
    }

    @Test
    void publishWithAMalformedIdIs400() throws Exception {
        mockMvc.perform(post("/api/catalog/products/not-a-uuid/publish"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(publishProduct);
    }

    @Test
    void retireReturns200WithTheRetiredProduct() throws Exception {
        when(retireProduct.retire(ID)).thenReturn(
                new RetireOutcome.Retired(view(ProductState.RETIRED, Money.of(4999, "EUR"), PUBLISHED_AT)));

        mockMvc.perform(post("/api/catalog/products/{id}/retire", ID.value()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("RETIRED"));
    }

    @Test
    void retireOfAnUnknownProductIs404() throws Exception {
        when(retireProduct.retire(ID)).thenReturn(new RetireOutcome.NotFound());

        mockMvc.perform(post("/api/catalog/products/{id}/retire", ID.value()))
                .andExpect(status().isNotFound());
    }

    @Test
    void retireOfAProductThatIsNotPublishedIs409WithTheReason() throws Exception {
        when(retireProduct.retire(ID)).thenReturn(new RetireOutcome.NotPublished());

        mockMvc.perform(post("/api/catalog/products/{id}/retire", ID.value()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.reason").value("NOT_PUBLISHED"));
    }

    private static ProductView view(ProductState state, Money price, Instant publishedAt) {
        return new ProductView(ID, "Linen shirt", price, state, publishedAt);
    }
}
