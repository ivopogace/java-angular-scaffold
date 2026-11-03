package io.scaffold.starter.codegen;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class JooqCodegenTest {

    @Test
    void groupsTablesByTheirAreaPrefixAndSkipsInfrastructure() {
        Map<String, List<String>> byArea = JooqCodegen.tablesByArea(
                List.of("catalog_product", "flyway_schema_history", "billing_invoice", "event_publication",
                        "catalog_publication_log"),
                Set.of("billing", "catalog", "shipping"));

        assertThat(byArea).containsExactly(
                Map.entry("billing", List.of("billing_invoice")),
                Map.entry("catalog", List.of("catalog_product", "catalog_publication_log")));
    }

    @Test
    void rejectsATableThatBelongsToNoArea() {
        assertThatThrownBy(() -> JooqCodegen.tablesByArea(List.of("catalog_product", "invoice"), Set.of("catalog")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("[invoice] belong to no business area")
                .hasMessageContaining("<area>_<name>");
    }

    @Test
    void anAreaNameMustBeFollowedByAnUnderscore() {
        assertThatThrownBy(() -> JooqCodegen.tablesByArea(List.of("catalogue"), Set.of("catalog")))
                .isInstanceOf(IllegalStateException.class);
    }
}
