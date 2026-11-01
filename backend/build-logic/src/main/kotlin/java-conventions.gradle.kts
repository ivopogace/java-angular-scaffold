plugins {
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.compilerArgs.add("-parameters")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform {
        // -PexcludeTags=container skips the tests that need Docker.
        providers.gradleProperty("excludeTags").orNull
            ?.split(',')
            ?.map(String::trim)
            ?.filter(String::isNotEmpty)
            ?.forEach { excludeTags(it) }
    }
    reports.junitXml.isOutputPerTestCase = true
}
