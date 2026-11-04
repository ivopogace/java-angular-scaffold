package io.scaffold.starter;

import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAnyPackage;
import static com.tngtech.archunit.lang.SimpleConditionEvent.violated;
import static com.tngtech.archunit.lang.conditions.ArchConditions.be;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaAccess;
import com.tngtech.archunit.core.domain.JavaCall;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import io.scaffold.starter.shared.UseCase;
import java.lang.annotation.Annotation;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.jooq.PlainSQL;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.modulith.test.ApplicationModuleTest;

/** An area is a direct sub-package of the base package other than {@code shared} and {@code web}. */
final class ArchitectureRules {

    private static final Set<String> NON_AREA_PACKAGES = Set.of("shared", "web");
    private static final String REHYDRATE = "rehydrate";
    private static final String PERSISTENCE = "adapter.out.persistence";
    private static final String GENERATED_JOOQ = PERSISTENCE + ".jooq";
    private static final Pattern AREA_PACKAGE_SHAPE = Pattern.compile(
            "domain\\.(model|id|event)"
                    + "|application\\.(port\\.in|port\\.out|service)"
                    + "|adapter\\.in\\.(web|event)"
                    + "|adapter\\.out\\.[^.]+"
                    + "|adapter\\.out\\.persistence\\.jooq");

    private final String basePackage;

    private ArchitectureRules(String basePackage) {
        this.basePackage = basePackage;
    }

    static ArchitectureRules forBasePackage(String basePackage) {
        return new ArchitectureRules(basePackage);
    }

    List<ArchRule> all() {
        return List.of(
                applicationCoreIsSpringFree(),
                domainIsPure(),
                areaPackageShape(),
                servicesArePackagePrivateUseCases(),
                persistenceGoesThroughJooq(),
                noPlainSql(),
                adaptersDoNotUseServices(),
                adaptersArePackagePrivate(),
                publishedSurfaceIsAggregateFree(),
                drivingAdaptersGoThroughPortIn(),
                onlyDrivenAdaptersRehydrate(),
                publishedTypesAreDataOnly());
    }

    List<ArchRule> testRules() {
        return List.of(areaTestsAreModuleTests(), noPlainSql());
    }

    ArchRule areaTestsAreModuleTests() {
        DescribedPredicate<JavaClass> wholeAppTest = DescribedPredicate.describe(
                "a @SpringBootTest that is no @ApplicationModuleTest",
                item -> carries(item, SpringBootTest.class) && !carries(item, ApplicationModuleTest.class));
        return noClasses()
                .that(isAreaClass())
                .should(be(wholeAppTest))
                .as("area tests use @ApplicationModuleTest, not @SpringBootTest")
                .allowEmptyShould(true);
    }

    ArchRule applicationCoreIsSpringFree() {
        DescribedPredicate<JavaClass> forbidden = resideInAnyPackage("org.springframework..")
                .and(not(resideInAnyPackage("org.springframework.modulith..")))
                .or(resideInAnyPackage("java.sql..", "javax.sql.."))
                .as("Spring (other than Spring Modulith) or SQL types");
        return noClasses()
                .that(isApplicationCore())
                .should().dependOnClassesThat(forbidden)
                .as("application-core (domain, application, shared) is free of Spring and SQL")
                .allowEmptyShould(true);
    }

    ArchRule domainIsPure() {
        return classes()
                .that(isAreaClass().and(inLayer("domain")).and(not(isPackageInfo())))
                .should(onlyDependOnPermittedTypes())
                .as("domain classes depend only on the JDK, jMolecules, shared, their own domain and other areas' domain.id")
                .allowEmptyShould(true);
    }

    ArchRule areaPackageShape() {
        return classes()
                .that(isAreaClass())
                .should(new ArchCondition<JavaClass>("live in the permitted area packages") {
                    @Override
                    public void check(JavaClass item, ConditionEvents events) {
                        String relative = areaRelativePackage(item).orElseThrow();
                        boolean allowed = relative.isEmpty()
                                ? item.getSimpleName().equals("package-info")
                                : AREA_PACKAGE_SHAPE.matcher(relative).matches();
                        if (!allowed) {
                            events.add(violated(item, item.getName() + " is in area package '"
                                    + (relative.isEmpty() ? "<area root>" : relative)
                                    + "', which is not one of domain.{model,id,event}, application.{port.in,port.out,service}, "
                                    + "adapter.in.{web,event}, adapter.out.<name> or the generated " + GENERATED_JOOQ));
                        }
                    }
                })
                .as("area classes live only in the permitted packages")
                .allowEmptyShould(true);
    }

    ArchRule servicesArePackagePrivateUseCases() {
        return classes()
                .that(isAreaClass().and(inLayer("application.service")).and(topLevel()))
                .should(new ArchCondition<JavaClass>("be package-private, and annotated @UseCase when implementing a port.in interface") {
                    @Override
                    public void check(JavaClass item, ConditionEvents events) {
                        if (item.getModifiers().contains(JavaModifier.PUBLIC)) {
                            events.add(violated(item, item.getName() + " is public; services must be package-private"));
                        }
                        boolean implementsPortIn = item.getAllRawInterfaces().stream()
                                .anyMatch(iface -> areaRelativePackage(iface)
                                        .map(pkg -> pkg.equals("application.port.in"))
                                        .orElse(false));
                        if (implementsPortIn && !item.isAnnotatedWith(UseCase.class)) {
                            events.add(violated(item, item.getName()
                                    + " implements a port.in interface but is not annotated @UseCase"));
                        }
                    }
                })
                .as("services are package-private and, when implementing a port.in interface, annotated @UseCase")
                .allowEmptyShould(true);
    }

    /** {@code JdbcClient} is the escape hatch for SQL jOOQ does not model, so only an area's persistence adapters use it. */
    ArchRule persistenceGoesThroughJooq() {
        DescribedPredicate<JavaClass> neverUsed = resideInAnyPackage(
                "jakarta.persistence..", "org.hibernate..", "org.springframework.data..");
        DescribedPredicate<JavaClass> springJdbc = resideInAnyPackage("org.springframework.jdbc.core..");
        DescribedPredicate<JavaClass> escapeHatch = inLayer(PERSISTENCE);
        return classes()
                .should(new ArchCondition<JavaClass>("not depend on JPA, Hibernate or Spring Data, "
                        + "nor on JdbcClient or JdbcTemplate outside " + PERSISTENCE) {
                    @Override
                    public void check(JavaClass item, ConditionEvents events) {
                        for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                            JavaClass target = dependency.getTargetClass().getBaseComponentType();
                            if (neverUsed.test(target) || (springJdbc.test(target) && !escapeHatch.test(item))) {
                                events.add(violated(dependency, dependency.getDescription()));
                            }
                        }
                    }
                })
                .as("persistence goes through jOOQ: no JPA, Hibernate or Spring Data, and JdbcClient or JdbcTemplate "
                        + "only in an area's " + PERSISTENCE)
                .allowEmptyShould(true);
    }

    /**
     * A plain-SQL string bypasses the generated schema, so a column change no longer fails the compile; an area's
     * persistence adapters (and their tests) may use one as the escape hatch for SQL jOOQ does not model.
     */
    ArchRule noPlainSql() {
        DescribedPredicate<JavaCall<?>> plainSql = DescribedPredicate.describe("jOOQ's @PlainSQL API",
                call -> call.getTarget().resolveMember()
                        .map(member -> member.isAnnotatedWith(PlainSQL.class))
                        .orElse(false));
        return noClasses()
                .that(not(inLayer(PERSISTENCE)))
                .should().callCodeUnitWhere(plainSql)
                .as("queries use the generated jOOQ classes; plain-SQL strings only in an area's " + PERSISTENCE)
                .allowEmptyShould(true);
    }

    ArchRule adaptersDoNotUseServices() {
        return noClasses()
                .that().resideInAPackage("..adapter..")
                .should().dependOnClassesThat().resideInAPackage("..application.service..")
                .as("adapters do not depend on application.service")
                .allowEmptyShould(true);
    }

    /** jOOQ generates public classes; only the area's own adapters can reach them (Modulith keeps them internal). */
    ArchRule adaptersArePackagePrivate() {
        DescribedPredicate<JavaClass> adapterSide = isAreaClass().and(inLayer("adapter")).or(isWebEdge());
        return classes()
                .that(adapterSide.and(not(inLayer(GENERATED_JOOQ))).and(topLevel()).and(not(isPackageInfo())))
                .should().notBePublic()
                .as("adapter classes and the web edge are package-private, generated jOOQ classes aside")
                .allowEmptyShould(true);
    }

    ArchRule publishedSurfaceIsAggregateFree() {
        return noClasses()
                .that(isAreaClass().and(inLayer("application.port.in").or(inLayer("domain.event"))))
                .should().dependOnClassesThat(inDomainModel())
                .as("port.in and domain.event classes do not depend on domain.model")
                .allowEmptyShould(true);
    }

    ArchRule drivingAdaptersGoThroughPortIn() {
        return noClasses()
                .that(isAreaClass().and(inLayer("adapter.in")))
                .should().dependOnClassesThat(
                        inDomainModel().or(inLayer("application.port.out")).or(inLayer(GENERATED_JOOQ)))
                .as("driving adapters (adapter.in) do not depend on domain.model, application.port.out or the generated jOOQ classes")
                .allowEmptyShould(true);
    }

    ArchRule onlyDrivenAdaptersRehydrate() {
        DescribedPredicate<JavaClass> mayRehydrate = inLayer("domain.model").or(inLayer("adapter.out"));
        return classes()
                .that(not(mayRehydrate))
                .should(new ArchCondition<JavaClass>("not call or reference a domain.model " + REHYDRATE + " factory") {
                    @Override
                    public void check(JavaClass item, ConditionEvents events) {
                        for (JavaAccess<?> access : item.getAccessesFromSelf()) {
                            if (access.getName().equals(REHYDRATE) && inDomainModel().test(access.getTargetOwner())) {
                                events.add(violated(access, access.getDescription()));
                            }
                        }
                    }
                })
                .as("only domain.model and adapter.out call an aggregate's " + REHYDRATE + " factory")
                .allowEmptyShould(true);
    }

    /** What a driving adapter receives carries no business rule it could call instead of a use case. */
    ArchRule publishedTypesAreDataOnly() {
        return classes()
                .that(isAreaClass()
                        .and(inLayer("application.port.in").or(inLayer("domain.event")))
                        .and(not(isPackageInfo())))
                .should(new ArchCondition<JavaClass>("be interfaces without default methods, or records and enums without behaviour") {
                    @Override
                    public void check(JavaClass item, ConditionEvents events) {
                        if (!item.isInterface() && !item.isRecord() && !item.isEnum()) {
                            events.add(violated(item, item.getName()
                                    + " is a class; port.in and domain.event hold only interfaces, records and enums"));
                            return;
                        }
                        for (JavaMethod method : item.getMethods()) {
                            if (!isDataOnly(item, method)) {
                                events.add(violated(method, method.getFullName()
                                        + " is behaviour; port.in and domain.event types carry data, the use case decides"));
                            }
                        }
                    }
                })
                .as("port.in and domain.event types carry data, not behaviour")
                .allowEmptyShould(true);
    }

    private static boolean isDataOnly(JavaClass owner, JavaMethod method) {
        Set<JavaModifier> modifiers = method.getModifiers();
        if (modifiers.contains(JavaModifier.STATIC)) {
            return method.getRawReturnType().getBaseComponentType().equals(owner);
        }
        if (owner.isInterface()) {
            return modifiers.contains(JavaModifier.ABSTRACT);
        }
        return isObjectMethod(method) || isAccessor(owner, method);
    }

    private static boolean isObjectMethod(JavaMethod method) {
        List<JavaClass> parameters = method.getRawParameterTypes();
        return switch (method.getName()) {
            case "toString", "hashCode" -> parameters.isEmpty();
            case "equals" -> parameters.size() == 1 && parameters.getFirst().isEquivalentTo(Object.class);
            default -> false;
        };
    }

    private static boolean isAccessor(JavaClass owner, JavaMethod method) {
        return method.getRawParameterTypes().isEmpty()
                && owner.getFields().stream()
                        .anyMatch(field -> !field.getModifiers().contains(JavaModifier.STATIC)
                                && field.getName().equals(method.getName()));
    }

    private ArchCondition<JavaClass> onlyDependOnPermittedTypes() {
        return new ArchCondition<JavaClass>("depend only on permitted types") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String ownArea = areaOf(item).orElseThrow();
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    if (!isPermittedFromDomain(ownArea, dependency.getTargetClass())) {
                        events.add(violated(dependency, dependency.getDescription()));
                    }
                }
            }
        };
    }

    private boolean isPermittedFromDomain(String ownArea, JavaClass dependencyTarget) {
        JavaClass target = dependencyTarget.getBaseComponentType();
        if (target.isPrimitive()) {
            return true;
        }
        if (target.getName().startsWith("java.") || target.getName().startsWith("org.jmolecules.")) {
            return true;
        }
        if (target.getPackageName().equals(basePackage + ".shared")
                || target.getPackageName().startsWith(basePackage + ".shared.")) {
            return true;
        }
        Optional<String> targetArea = areaOf(target);
        if (targetArea.isEmpty()) {
            return false;
        }
        String relative = areaRelativePackage(target).orElseThrow();
        boolean inOtherAreaDomainId = relative.equals("domain.id");
        boolean inOwnDomain = targetArea.get().equals(ownArea) && startsWithLayer(relative, "domain");
        return inOwnDomain || inOtherAreaDomainId;
    }

    private DescribedPredicate<JavaClass> isAreaClass() {
        return DescribedPredicate.describe("area classes", item -> areaOf(item).isPresent());
    }

    private DescribedPredicate<JavaClass> isApplicationCore() {
        return DescribedPredicate.describe("application-core classes", item -> {
            String pkg = item.getPackageName();
            if (pkg.equals(basePackage + ".shared") || pkg.startsWith(basePackage + ".shared.")) {
                return true;
            }
            return areaRelativePackage(item)
                    .map(relative -> startsWithLayer(relative, "domain") || startsWithLayer(relative, "application"))
                    .orElse(false);
        });
    }

    private DescribedPredicate<JavaClass> isWebEdge() {
        return DescribedPredicate.describe("web edge classes", item -> {
            String pkg = item.getPackageName();
            return pkg.equals(basePackage + ".web") || pkg.startsWith(basePackage + ".web.");
        });
    }

    private DescribedPredicate<JavaClass> inLayer(String layer) {
        return DescribedPredicate.describe("in " + layer, item -> areaRelativePackage(item)
                .map(relative -> startsWithLayer(relative, layer))
                .orElse(false));
    }

    private DescribedPredicate<JavaClass> inDomainModel() {
        return DescribedPredicate.describe("domain.model classes", item -> areaRelativePackage(item.getBaseComponentType())
                .map(relative -> startsWithLayer(relative, "domain.model"))
                .orElse(false));
    }

    private static boolean carries(JavaClass item, Class<? extends Annotation> annotation) {
        return Stream.concat(Stream.of(item), item.getAllRawSuperclasses().stream())
                .anyMatch(type -> type.isAnnotatedWith(annotation) || type.isMetaAnnotatedWith(annotation));
    }

    private static DescribedPredicate<JavaClass> isPackageInfo() {
        return DescribedPredicate.describe("package-info", item -> item.getSimpleName().equals("package-info"));
    }

    private static DescribedPredicate<JavaClass> topLevel() {
        return DescribedPredicate.describe("top-level", JavaClass::isTopLevelClass);
    }

    private static boolean startsWithLayer(String relative, String layer) {
        return relative.equals(layer) || relative.startsWith(layer + ".");
    }

    private Optional<String> areaOf(JavaClass type) {
        String pkg = type.getPackageName();
        if (!pkg.startsWith(basePackage + ".")) {
            return Optional.empty();
        }
        String first = pkg.substring(basePackage.length() + 1).split("\\.", 2)[0];
        return NON_AREA_PACKAGES.contains(first) ? Optional.empty() : Optional.of(first);
    }

    /** The package below {@code <base>.<area>}: empty at the area root, empty Optional outside any area. */
    private Optional<String> areaRelativePackage(JavaClass type) {
        return areaOf(type).map(area -> {
            String prefix = basePackage + "." + area;
            return type.getPackageName().length() == prefix.length()
                    ? ""
                    : type.getPackageName().substring(prefix.length() + 1);
        });
    }
}
