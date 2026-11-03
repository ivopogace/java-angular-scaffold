package io.scaffold.starter.codegen;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.flywaydb.core.Flyway;
import org.jooq.codegen.GenerationTool;
import org.jooq.meta.jaxb.Configuration;
import org.jooq.meta.jaxb.Database;
import org.jooq.meta.jaxb.ForcedType;
import org.jooq.meta.jaxb.Generate;
import org.jooq.meta.jaxb.Generator;
import org.jooq.meta.jaxb.Jdbc;
import org.jooq.meta.jaxb.Logging;
import org.jooq.meta.jaxb.Strategy;
import org.jooq.meta.jaxb.Target;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Migrates a throwaway PostgreSQL with the Flyway migrations and generates each business area's jOOQ
 * classes into {@code <base>.<area>.adapter.out.persistence.jooq}, from the tables named
 * {@code <area>_…}. A table that belongs to no area and is not infrastructure fails the run.
 *
 * <p>Arguments: {@code generate|check <basePackage> <postgresImage> <migrationsDir> <areasDir>
 * <outputDir>}. {@code check} generates into a temporary directory and exits 1, listing the files,
 * when it differs from {@code outputDir}.
 */
public final class JooqCodegen {

    private static final Set<String> INFRASTRUCTURE_TABLES = Set.of("flyway_schema_history", "event_publication");
    private static final Set<String> NON_AREA_PACKAGES = Set.of("shared", "web");
    private static final String SCHEMA = "public";
    private static final String TIMESTAMPTZ = "(?i:timestamp\\ with\\ time\\ zone)";
    private static final String REGENERATE = "./gradlew :adapters:generateJooq";

    private JooqCodegen() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 6 || !Set.of("generate", "check").contains(args[0])) {
            throw new IllegalArgumentException(
                    "Usage: JooqCodegen generate|check <basePackage> <postgresImage> <migrationsDir> <areasDir> <outputDir>");
        }
        boolean check = args[0].equals("check");
        String basePackage = args[1];
        Path output = Path.of(args[5]).toAbsolutePath();
        Path target = check ? Files.createTempDirectory("jooq-check") : output;
        try (PostgreSQLContainer postgres = new PostgreSQLContainer(args[2])) {
            postgres.start();
            Flyway.configure()
                    .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .locations("filesystem:" + Path.of(args[3]).toAbsolutePath())
                    .load()
                    .migrate();
            Map<String, List<String>> tablesByArea = tablesByArea(tables(postgres), areas(Path.of(args[4])));
            deleteRecursively(target);
            for (String area : tablesByArea.keySet()) {
                GenerationTool.generate(configuration(postgres, area, basePackage + "." + area
                        + ".adapter.out.persistence.jooq", target));
            }
        }
        if (check) {
            List<String> differences = differences(output, target);
            deleteRecursively(target);
            if (!differences.isEmpty()) {
                System.err.println("The committed jOOQ classes do not match the migrations; run " + REGENERATE
                        + " and commit the result. Differing files:\n  " + String.join("\n  ", differences));
                System.exit(1);
            }
        }
    }

    private static Configuration configuration(PostgreSQLContainer postgres, String area, String targetPackage,
            Path directory) {
        return new Configuration()
                .withLogging(Logging.WARN)
                .withJdbc(new Jdbc()
                        .withUrl(postgres.getJdbcUrl())
                        .withUser(postgres.getUsername())
                        .withPassword(postgres.getPassword()))
                .withGenerator(new Generator()
                        .withStrategy(new Strategy().withName(FlatPackageStrategy.class.getName()))
                        .withDatabase(new Database()
                                .withName("org.jooq.meta.postgres.PostgresDatabase")
                                .withInputSchema(SCHEMA)
                                .withIncludes(area + "_.*")
                                .withForcedTypes(new ForcedType().withName("INSTANT").withIncludeTypes(TIMESTAMPTZ)))
                        .withGenerate(new Generate().withDeprecated(false))
                        .withTarget(new Target()
                                .withPackageName(targetPackage)
                                .withDirectory(directory.toString())
                                .withEncoding(StandardCharsets.UTF_8.name())));
    }

    private static List<String> tables(PostgreSQLContainer postgres) throws SQLException {
        try (Connection connection = DriverManager.getConnection(
                        postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
                ResultSet rows = connection.getMetaData().getTables(null, SCHEMA, "%", new String[] {"TABLE", "VIEW"})) {
            List<String> names = new ArrayList<>();
            while (rows.next()) {
                names.add(rows.getString("TABLE_NAME"));
            }
            return names;
        }
    }

    private static Set<String> areas(Path areasDir) throws IOException {
        try (Stream<Path> children = Files.list(areasDir)) {
            return children.filter(Files::isDirectory)
                    .map(dir -> dir.getFileName().toString())
                    .filter(name -> !NON_AREA_PACKAGES.contains(name))
                    .collect(TreeSet::new, Set::add, Set::addAll);
        }
    }

    static Map<String, List<String>> tablesByArea(List<String> tables, Set<String> areas) {
        Map<String, List<String>> byArea = new TreeMap<>();
        List<String> orphans = new ArrayList<>();
        for (String table : tables) {
            if (INFRASTRUCTURE_TABLES.contains(table)) {
                continue;
            }
            areas.stream()
                    .filter(area -> table.startsWith(area + "_"))
                    .findFirst()
                    .ifPresentOrElse(area -> byArea.computeIfAbsent(area, _ -> new ArrayList<>()).add(table),
                            () -> orphans.add(table));
        }
        if (!orphans.isEmpty()) {
            throw new IllegalStateException("Tables " + orphans + " belong to no business area: name each table "
                    + "<area>_<name>, where <area> is one of " + areas);
        }
        return byArea;
    }

    private static List<String> differences(Path committed, Path generated) throws IOException {
        Map<String, String> expected = contents(generated);
        Map<String, String> actual = contents(committed);
        Set<String> paths = new TreeSet<>(expected.keySet());
        paths.addAll(actual.keySet());
        return paths.stream()
                .filter(path -> !expected.getOrDefault(path, "").equals(actual.getOrDefault(path, "")))
                .map(path -> !actual.containsKey(path) ? path + " (missing)"
                        : !expected.containsKey(path) ? path + " (not generated)" : path + " (changed)")
                .toList();
    }

    private static Map<String, String> contents(Path root) throws IOException {
        Map<String, String> files = new TreeMap<>();
        if (!Files.isDirectory(root)) {
            return files;
        }
        try (Stream<Path> paths = Files.walk(root)) {
            paths.filter(Files::isRegularFile).forEach(file -> files.put(
                    root.relativize(file).toString().replace('\\', '/'),
                    read(file).replace("\r\n", "\n")));
        }
        return files;
    }

    private static String read(Path file) {
        try {
            return Files.readString(file);
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    private static void deleteRecursively(Path root) throws IOException {
        if (!Files.exists(root)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(root)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.delete(path);
            }
        }
    }
}
