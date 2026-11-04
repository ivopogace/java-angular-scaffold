package io.scaffold.starter.catalog.adapter.in.web;

import io.scaffold.starter.catalog.application.port.in.CreateProduct;
import io.scaffold.starter.catalog.application.port.in.CreateProductCommand;
import io.scaffold.starter.catalog.application.port.in.FindProduct;
import io.scaffold.starter.catalog.application.port.in.ListProducts;
import io.scaffold.starter.catalog.application.port.in.ProductView;
import io.scaffold.starter.catalog.application.port.in.PublishOutcome;
import io.scaffold.starter.catalog.application.port.in.PublishProduct;
import io.scaffold.starter.catalog.application.port.in.RetireOutcome;
import io.scaffold.starter.catalog.application.port.in.RetireProduct;
import io.scaffold.starter.catalog.domain.id.ProductId;
import io.scaffold.starter.shared.Money;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/catalog/products")
class ProductController {

    private static final String REASON = "reason";
    private static final String NOT_PUBLISHED = "NOT_PUBLISHED";
    private static final String CONCURRENT_CHANGE = "CONCURRENT_CHANGE";

    private final CreateProduct createProduct;
    private final FindProduct findProduct;
    private final PublishProduct publishProduct;
    private final RetireProduct retireProduct;
    private final ListProducts listProducts;

    ProductController(
            CreateProduct createProduct,
            FindProduct findProduct,
            PublishProduct publishProduct,
            RetireProduct retireProduct,
            ListProducts listProducts) {
        this.createProduct = createProduct;
        this.findProduct = findProduct;
        this.publishProduct = publishProduct;
        this.retireProduct = retireProduct;
        this.listProducts = listProducts;
    }

    @GetMapping
    List<ProductResponse> list() {
        return listProducts.list().stream().map(ProductResponse::from).toList();
    }

    @GetMapping("/{id}")
    ResponseEntity<?> get(@PathVariable UUID id) {
        Optional<ProductView> found = findProduct.find(new ProductId(id));
        return found.isPresent() ? ResponseEntity.ok(ProductResponse.from(found.get())) : notFound(id);
    }

    @PostMapping
    ResponseEntity<ProductResponse> create(@Valid @RequestBody CreateProductRequest request) {
        ProductView created = createProduct.create(new CreateProductCommand(request.name(), toMoney(request)));
        URI location = ServletUriComponentsBuilder.fromCurrentRequestUri()
                .path("/{id}")
                .buildAndExpand(created.id().value())
                .toUri();
        return ResponseEntity.created(location).body(ProductResponse.from(created));
    }

    @PostMapping("/{id}/publish")
    ResponseEntity<?> publish(@PathVariable UUID id) {
        return switch (publishProduct.publish(new ProductId(id))) {
            case PublishOutcome.Published published -> ResponseEntity.ok(ProductResponse.from(published.product()));
            case PublishOutcome.NotFound _ -> notFound(id);
            case PublishOutcome.Rejected rejected -> conflict(
                    "Product " + id + " cannot be published: " + rejected.reason(), rejected.reason().name());
            case PublishOutcome.ConcurrentChange _ -> concurrentChange(id);
        };
    }

    @PostMapping("/{id}/retire")
    ResponseEntity<?> retire(@PathVariable UUID id) {
        return switch (retireProduct.retire(new ProductId(id))) {
            case RetireOutcome.Retired retired -> ResponseEntity.ok(ProductResponse.from(retired.product()));
            case RetireOutcome.NotFound _ -> notFound(id);
            case RetireOutcome.NotPublished _ -> conflict("Product " + id + " is not published", NOT_PUBLISHED);
            case RetireOutcome.ConcurrentChange _ -> concurrentChange(id);
        };
    }

    private static Money toMoney(CreateProductRequest request) {
        if (request.priceMinor() == null) {
            return null;
        }
        try {
            return Money.of(request.priceMinor(), request.currency());
        } catch (IllegalArgumentException _) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown currency: " + request.currency());
        }
    }

    private static ResponseEntity<ProblemDetail> notFound(UUID id) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "No product " + id);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
    }

    private static ResponseEntity<ProblemDetail> concurrentChange(UUID id) {
        return conflict("Product " + id + " was changed by another request; reload it and retry", CONCURRENT_CHANGE);
    }

    private static ResponseEntity<ProblemDetail> conflict(String detail, String reason) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, detail);
        problem.setProperty(REASON, reason);
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }
}
