package io.scaffold.starter;

import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.EvaluationResult;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Proves {@link ArchitectureRules} can fail: each deliberately mis-shaped class under
 * {@code archfixture} must be reported by the rule meant to catch it, and the conforming
 * {@code archfixture.clean} area by none. The fixtures sit outside the application's base
 * package, so the production scan never sees them.
 */
class ArchitectureRulesNegativeTest {

    private static final String FIXTURE_BASE = "archfixture";
    private static final JavaClasses FIXTURES = new ClassFileImporter().importPackages(FIXTURE_BASE);
    private static final ArchitectureRules RULES = ArchitectureRules.forBasePackage(FIXTURE_BASE);

    static Stream<Arguments> violations() {
        return Stream.of(
                violation("coreIsSpringFree", ArchitectureRules::coreIsSpringFree, "archfixture.orders.domain.model.SpringyOrder"),
                violation("domainIsPure", ArchitectureRules::domainIsPure, "archfixture.orders.domain.model.SpringyOrder"),
                violation("domainIsPure", ArchitectureRules::domainIsPure, "archfixture.orders.domain.model.JpaOrder"),
                violation("noJpa", ArchitectureRules::noJpa, "archfixture.orders.domain.model.JpaOrder"),
                violation("servicesArePackagePrivateUseCases", ArchitectureRules::servicesArePackagePrivateUseCases,
                        "archfixture.orders.application.service.PublicOrderService"),
                violation("servicesArePackagePrivateUseCases", ArchitectureRules::servicesArePackagePrivateUseCases,
                        "archfixture.orders.application.service.UnmarkedService"),
                violation("areaPackageShape", ArchitectureRules::areaPackageShape, "archfixture.orders.misc.Stray"),
                violation("areaPackageShape", ArchitectureRules::areaPackageShape, "archfixture.config.StrayWiring"),
                violation("adaptersDoNotUseServices", ArchitectureRules::adaptersDoNotUseServices,
                        "archfixture.orders.adapter.in.web.ServiceCaller"),
                violation("adaptersArePackagePrivate", ArchitectureRules::adaptersArePackagePrivate,
                        "archfixture.orders.adapter.out.persistence.PublicOrderRepository"),
                violation("adaptersArePackagePrivate", ArchitectureRules::adaptersArePackagePrivate,
                        "archfixture.web.PublicAdvice"),
                violation("publishedSurfaceIsAggregateFree", ArchitectureRules::publishedSurfaceIsAggregateFree,
                        "archfixture.orders.application.port.in.LeakyOrderView"),
                violation("publishedSurfaceIsAggregateFree", ArchitectureRules::publishedSurfaceIsAggregateFree,
                        "archfixture.orders.domain.event.OrdersPlaced"));
    }

    private static Arguments violation(String name, Function<ArchitectureRules, ArchRule> rule, String offender) {
        return Arguments.of(name, rule, offender);
    }

    @ParameterizedTest(name = "{0} reports {2}")
    @MethodSource("violations")
    void ruleReportsTheOffendingFixture(String ruleName, Function<ArchitectureRules, ArchRule> rule, String offender) {
        EvaluationResult result = rule.apply(RULES).evaluate(FIXTURES);

        assertThat(result.hasViolation()).as(ruleName).isTrue();
        assertThat(String.join("\n", result.getFailureReport().getDetails())).contains(offender);
    }

    @Test
    void noRuleReportsTheCleanArea() {
        List<ArchRule> rules = RULES.all();

        assertThat(rules).hasSize(8);
        for (ArchRule rule : rules) {
            EvaluationResult result = rule.evaluate(FIXTURES);
            assertThat(String.join("\n", result.getFailureReport().getDetails()))
                    .as(rule.getDescription())
                    .doesNotContain("archfixture.clean");
        }
    }

    @Test
    void everyRuleToleratesAnEmptyClassSet() {
        JavaClasses none = new ClassFileImporter().importPackages("archfixture.doesnotexist");

        for (ArchRule rule : RULES.all()) {
            assertThat(rule.evaluate(none).hasViolation()).as(rule.getDescription()).isFalse();
        }
    }
}
