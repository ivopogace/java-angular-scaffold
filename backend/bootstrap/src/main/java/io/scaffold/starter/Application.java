package io.scaffold.starter;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;

@SpringBootApplication
@Modulithic(sharedModules = "shared")
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
