package io.scaffold.starter.codegen;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class JooqCodegenTest {

    private static final Set<String> INFRASTRUCTURE = JooqCodegen.infrastructureTables("event_publication");

    @Test
    void groupsTablesByTheirAreaPrefixAndSkipsInfrastructure() {
        Map<String, List<String>> byArea = JooqCodegen.tablesByArea(
                List.of("catalog_product", "flyway_schema_history", "billing_invoice", "event_publication",
                        "catalog_publication_log"),
                Set.of("billing", "catalog", "shipping"),
                INFRASTRUCTURE);

        assertThat(byArea).containsExactly(
                Map.entry("billing", List.of("billing_invoice")),
                Map.entry("catalog", List.of("catalog_product", "catalog_publication_log")));
    }

    @Test
    void rejectsATableThatBelongsToNoArea() {
        assertThatThrownBy(() -> JooqCodegen.tablesByArea(
                        List.of("catalog_product", "invoice"), Set.of("catalog"), INFRASTRUCTURE))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("[invoice] belong to no business area")
                .hasMessageContaining("<area>_<name>")
                .hasMessageContaining("infrastructureTables");
    }

    @Test
    void anAreaNameMustBeFollowedByAnUnderscore() {
        assertThatThrownBy(() -> JooqCodegen.tablesByArea(List.of("catalogue"), Set.of("catalog"), INFRASTRUCTURE))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void aConfiguredInfrastructureTableIsSkipped() {
        List<String> tables = List.of("catalog_product", "event_publication", "event_publication_archive", "shedlock");

        assertThatThrownBy(() -> JooqCodegen.tablesByArea(tables, Set.of("catalog"), INFRASTRUCTURE))
                .hasMessageContaining("[event_publication_archive, shedlock] belong to no business area");
        assertThat(JooqCodegen.tablesByArea(tables, Set.of("catalog"),
                        JooqCodegen.infrastructureTables(" event_publication, event_publication_archive,shedlock ")))
                .containsExactly(Map.entry("catalog", List.of("catalog_product")));
    }

    @Test
    void aTableMatchingTwoAreasBelongsToTheLongerOne() {
        assertThat(JooqCodegen.tablesByArea(List.of("catalog_product", "catalog_admin_user"),
                        Set.of("catalog", "catalog_admin"), INFRASTRUCTURE))
                .containsExactly(
                        Map.entry("catalog", List.of("catalog_product")),
                        Map.entry("catalog_admin", List.of("catalog_admin_user")));
    }

    @Test
    void anAreaGeneratesNoObjectOfALongerArea() {
        Set<String> areas = Set.of("catalog", "catalog_admin", "catalog_admin_audit", "billing");

        assertThat(JooqCodegen.database("catalog", areas).getIncludes()).isEqualTo("catalog_.*");
        assertThat(JooqCodegen.database("catalog", areas).getExcludes())
                .isEqualTo("catalog_admin_.*|catalog_admin_audit_.*");
        assertThat(JooqCodegen.database("catalog_admin", areas).getExcludes()).isEqualTo("catalog_admin_audit_.*");
        assertThat(JooqCodegen.database("billing", areas).getExcludes()).isNullOrEmpty();
    }

    @Test
    void areasAreACommaSeparatedListThatMayBeEmpty() {
        assertThat(JooqCodegen.names("catalog, billing")).containsExactly("billing", "catalog");
        assertThat(JooqCodegen.names("")).isEmpty();
    }

    @Test
    void flywayHistoryIsAlwaysInfrastructure() {
        assertThat(JooqCodegen.infrastructureTables("")).containsExactly("flyway_schema_history");
    }
}
