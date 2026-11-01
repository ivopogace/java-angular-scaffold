import org.gradle.api.artifacts.component.ModuleComponentIdentifier

plugins {
    `java-library`
    id("java-conventions")
}

dependencies {
    api(platform(libs.jmolecules.bom))
    api("org.jmolecules:jmolecules-ddd")
    api("org.jmolecules:jmolecules-events")
    api("org.jmolecules:jmolecules-hexagonal-architecture")
    api(libs.jakarta.transaction.api)
    api(platform(libs.spring.modulith.bom))
    api("org.springframework.modulith:spring-modulith-api")

    testImplementation(platform(libs.spring.boot.bom))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testImplementation("org.assertj:assertj-core")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.register("checkCoreClasspath") {
    group = "verification"
    description = "Fails if core's runtime classpath carries Spring (beyond spring-modulith-api) or JPA."
    val resolvedJars = configurations.runtimeClasspath.get().incoming.artifacts.resolvedArtifacts
    doLast {
        val allowed = "org.springframework.modulith:spring-modulith-api"
        val offenders = resolvedJars.get()
            .mapNotNull { it.id.componentIdentifier as? ModuleComponentIdentifier }
            .filter { module ->
                val coordinates = "${module.group}:${module.module}"
                (module.group.startsWith("org.springframework") && coordinates != allowed) ||
                    module.group.startsWith("org.hibernate") ||
                    module.group.startsWith("jakarta.persistence")
            }
            .map { "${it.group}:${it.module}:${it.version}" }
            .sorted()
        if (offenders.isNotEmpty()) {
            throw GradleException(
                "core must stay free of Spring and JPA, but its runtime classpath contains:\n  " +
                    offenders.joinToString("\n  ")
            )
        }
    }
}

tasks.named("check") {
    dependsOn("checkCoreClasspath")
}
