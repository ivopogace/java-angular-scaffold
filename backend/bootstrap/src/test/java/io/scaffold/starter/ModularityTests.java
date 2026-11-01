package io.scaffold.starter;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

    @Test
    void applicationModulesAreWellFormed() {
        ApplicationModules.of(Application.class).verify();
    }
}
