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
import java.util.stream.Collectors;
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
import org.testcontainers.utility.DockerImageName;

/**
 * Migrates a throwaway PostgreSQL with the Flyway migrations and generates each business area's jOOQ
 * classes into {@code <base>.<area>.adapter.out.persistence.jooq}, from the tables named
 * {@code <area>_…}; a table matching two areas belongs to the longer one. A table, view or
 * partitioned, foreign or materialized table that belongs to no area and is not infrastructure
 * fails the run.
 *
 * <p>Arguments: {@code generate|check <basePackage> <postgresImage> <migrationsDir> <areas> <outputDir>
 * <infrastructureTables>}, the two lists comma-separated and possibly empty; Flyway's history table
 * is always infrastructure. The image may be any PostgreSQL-compatible one, such as
 * {@code pgvector/pgvector:pg18}. Generation runs into a temporary directory: {@code generate}
 * replaces {@code outputDir} with it only after every area generated, {@code check} exits 1, listing
 * the files, when it differs from {@code outputDir}.
 */
public final class JooqCodegen {

    private static final String FLYWAY_HISTORY = "flyway_schema_history";
    private static final String SCHEMA = "public";
    private static final String[] TABLE_TYPES =
            {"TABLE", "VIEW", "PARTITIONED TABLE", "MATERIALIZED VIEW", "FOREIGN TABLE"};
    private static final String TIMESTAMPTZ = "(?i:timestamp\\ with\\ time\\ zone)";
    private static final String REGENERATE = "./gradlew :adapters:generateJooq";

    private JooqCodegen() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 7 || !Set.of("generate", "check").contains(args[0])) {
            throw new IllegalArgumentException("Usage: JooqCodegen generate|check <basePackage> <postgresImage> "
                    + "<migrationsDir> <areas> <outputDir> <infrastructureTables>");
        }
        boolean check = args[0].equals("check");
        String basePackage = args[1];
        Set<String> areas = names(args[4]);
        Path output = Path.of(args[5]).toAbsolutePath();
        Set<String> infrastructure = infrastructureTables(args[6]);
        Path generated = Files.createTempDirectory("jooq-generated");
        List<String> differences;
        try {
            try (PostgreSQLContainer postgres = new PostgreSQLContainer(
                    DockerImageName.parse(args[2]).asCompatibleSubstituteFor("postgres"))) {
                postgres.start();
                Flyway.configure()
                        .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                        .locations("filesystem:" + Path.of(args[3]).toAbsolutePath())
                        .load()
                        .migrate();
                Map<String, List<String>> tablesByArea;
                try (Connection connection = DriverManager.getConnection(
                        postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
                    tablesByArea = tablesByArea(tables(connection), areas, infrastructure);
                }
                for (String area : tablesByArea.keySet()) {
                    GenerationTool.generate(configuration(postgres, database(area, areas),
                            basePackage + "." + area + ".adapter.out.persistence.jooq", generated));
                }
            }
            differences = differences(output, generated);
            if (!check && !differences.isEmpty()) {
                deleteRecursively(output);
                copyRecursively(generated, output);
            }
        } finally {
            deleteRecursively(generated);
        }
        if (check && !differences.isEmpty()) {
            System.err.println("The committed jOOQ classes do not match the migrations; run " + REGENERATE
                    + " and commit the result. Differing files:\n  " + String.join("\n  ", differences));
            System.exit(1);
        }
    }

    private static Configuration configuration(PostgreSQLContainer postgres, Database database, String targetPackage,
            Path directory) {
        return new Configuration()
                .withLogging(Logging.WARN)
                .withJdbc(new Jdbc()
                        .withUrl(postgres.getJdbcUrl())
                        .withUser(postgres.getUsername())
                        .withPassword(postgres.getPassword()))
                .withGenerator(new Generator()
                        .withStrategy(new Strategy().withName(FlatPackageStrategy.class.getName()))
                        .withDatabase(database)
                        .withGenerate(new Generate().withDeprecated(false))
                        .withTarget(new Target()
                                .withPackageName(targetPackage)
                                .withDirectory(directory.toString())
                                .withEncoding(StandardCharsets.UTF_8.name())));
    }

    /** The area's objects: named {@code <area>_…}, but not those of a longer area such as {@code <area>_admin}. */
    static Database database(String area, Set<String> areas) {
        Database database = new Database()
                .withName("org.jooq.meta.postgres.PostgresDatabase")
                .withInputSchema(SCHEMA)
                .withIncludes(area + "_.*")
                .withForcedTypes(new ForcedType().withName("INSTANT").withIncludeTypes(TIMESTAMPTZ));
        String longer = areas.stream()
                .filter(other -> other.startsWith(area + "_"))
                .sorted()
                .map(other -> other + "_.*")
                .collect(Collectors.joining("|"));
        return longer.isEmpty() ? database : database.withExcludes(longer);
    }

    static List<String> tables(Connection connection) throws SQLException {
        try (ResultSet rows = connection.getMetaData().getTables(null, SCHEMA, "%", TABLE_TYPES)) {
            List<String> names = new ArrayList<>();
            while (rows.next()) {
                names.add(rows.getString("TABLE_NAME"));
            }
            return names;
        }
    }

    static Set<String> names(String commaSeparated) {
        return Stream.of(commaSeparated.split(","))
                .map(String::trim)
                .filter(name -> !name.isEmpty())
                .collect(Collectors.toCollection(TreeSet::new));
    }

    /** The configured infrastructure tables, comma-separated, plus Flyway's history table. */
    static Set<String> infrastructureTables(String commaSeparated) {
        Set<String> tables = names(commaSeparated);
        tables.add(FLYWAY_HISTORY);
        return tables;
    }

    static Map<String, List<String>> tablesByArea(List<String> tables, Set<String> areas, Set<String> infrastructure) {
        Map<String, List<String>> byArea = new TreeMap<>();
        List<String> orphans = new ArrayList<>();
        for (String table : tables) {
            if (infrastructure.contains(table)) {
                continue;
            }
            areas.stream()
                    .filter(area -> table.startsWith(area + "_"))
                    .max(Comparator.comparingInt(String::length))
                    .ifPresentOrElse(area -> byArea.computeIfAbsent(area, _ -> new ArrayList<>()).add(table),
                            () -> orphans.add(table));
        }
        if (!orphans.isEmpty()) {
            throw new IllegalStateException("Tables " + orphans + " belong to no business area: name each table "
                    + "<area>_<name>, where <area> is one of " + areas + ", or list an infrastructure table in "
                    + "infrastructureTables in backend/adapters/build.gradle");
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

    private static void copyRecursively(Path source, Path target) throws IOException {
        try (Stream<Path> paths = Files.walk(source)) {
            for (Path path : paths.toList()) {
                Path copy = target.resolve(source.relativize(path).toString());
                if (Files.isDirectory(path)) {
                    Files.createDirectories(copy);
                } else {
                    Files.copy(path, copy);
                }
            }
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
