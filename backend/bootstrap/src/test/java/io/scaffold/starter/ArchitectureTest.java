package io.scaffold.starter;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Stream;
import org.jmolecules.archunit.JMoleculesArchitectureRules;
import org.jmolecules.archunit.JMoleculesDddRules;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

/**
 * The structural net: the project's structural rules plus jMolecules' DDD and hexagonal rules over
 * the production classes, and the test rules over the test classes.
 */
class ArchitectureTest {

    private static final String BASE_PACKAGE = Application.class.getPackageName();
    private static final JavaClasses PRODUCTION = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages(BASE_PACKAGE);
    private static final JavaClasses TESTS = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.ONLY_INCLUDE_TESTS)
            .importPackages(BASE_PACKAGE);

    @TestFactory
    Stream<DynamicTest> productionClassesFollowEveryRule() {
        Map<String, ArchRule> rules = new LinkedHashMap<>();
        ArchitectureRules.forBasePackage(BASE_PACKAGE).all()
                .forEach(rule -> rules.put(rule.getDescription(), rule));
        rules.put("jMolecules DDD rules", JMoleculesDddRules.all());
        rules.put("jMolecules hexagonal architecture", JMoleculesArchitectureRules.ensureHexagonal());
        return rules.entrySet().stream()
                .map(rule -> DynamicTest.dynamicTest(rule.getKey(), () -> rule.getValue().check(PRODUCTION)));
    }

    @TestFactory
    Stream<DynamicTest> testClassesFollowEveryTestRule() {
        return ArchitectureRules.forBasePackage(BASE_PACKAGE).testRules().stream()
                .map(rule -> DynamicTest.dynamicTest(rule.getDescription(), () -> rule.check(TESTS)));
    }
}
