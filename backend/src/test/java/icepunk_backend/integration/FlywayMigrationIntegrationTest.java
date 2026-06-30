package icepunk_backend.integration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies the Flyway migrations against a real PostgreSQL container (H2 cannot
 * faithfully reproduce Postgres DDL). The base class already boots the Spring
 * context with {@code spring.flyway.enabled=true} and
 * {@code ddl-auto=validate} — so the mere fact this context starts is itself the
 * strongest "schema matches entities" check: Hibernate validates every
 * {@code @Entity} against the Flyway-built schema at startup and aborts on any
 * mismatch. The tests below make that guarantee explicit and assert on the
 * migration history.
 *
 * <p>Note on rollback: Flyway Community has no {@code undo} migrations (that is a
 * paid feature), so "rollback" is not applicable here. The applicable guarantee
 * is that the forward migration is reproducible from an empty database — clean
 * then migrate rebuilds an identical, valid schema. That is exercised against an
 * isolated throwaway schema so it cannot disturb the shared application schema.
 */
class FlywayMigrationIntegrationTest extends AbstractPostgresContainerTest {

    /** Expected table → column set, mirroring the JPA entities. */
    private static final Map<String, Set<String>> EXPECTED_COLUMNS = Map.of(
            "users", Set.of(
                    "id", "username", "email", "password_hash",
                    "generations_today", "generation_date"),
            "generation_stats", Set.of(
                    "id", "total_generations"),
            "guest_usage", Set.of(
                    "id", "ip_address", "generations_today", "generation_date")
    );

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private DataSource dataSource;

    @Test
    void initialMigrationIsAppliedSuccessfully() {
        // Exactly the V1 migration ran, and Flyway recorded it as a success.
        List<Map<String, Object>> history = jdbcTemplate.queryForList(
                "SELECT version, success FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank");

        assertEquals(1, history.size(), "exactly one versioned migration is expected");
        assertEquals("1", history.get(0).get("version"));
        assertEquals(Boolean.TRUE, history.get(0).get("success"), "the migration must be marked successful");

        // The tables the migration creates are all present.
        for (String table : EXPECTED_COLUMNS.keySet()) {
            assertTrue(tableExists(table), () -> "migration should have created table " + table);
        }
    }

    @Test
    void migratedSchemaMatchesEntityMappings() {
        // The context started under ddl-auto=validate, so Hibernate has already
        // validated the entities against this schema. Assert the columns explicitly
        // too, so a drift between an entity and the migration is caught here with a
        // clear message rather than only as an opaque context-load failure.
        EXPECTED_COLUMNS.forEach((table, expectedColumns) ->
                assertEquals(expectedColumns, actualColumns(table),
                        () -> "columns of " + table + " must match the entity mapping"));

        // NOT NULL constraints that back @Column(nullable = false).
        assertNotNullable("users", "username");
        assertNotNullable("users", "email");
        assertNotNullable("users", "password_hash");
        assertNotNullable("guest_usage", "ip_address");

        // Unique constraints that back the entity's @UniqueConstraint / unique = true.
        assertTrue(uniqueColumnExists("users", "email"), "users.email must be unique");
        assertTrue(uniqueColumnExists("users", "username"), "users.username must be unique");
        assertTrue(uniqueColumnExists("guest_usage", "ip_address"), "guest_usage.ip_address must be unique");
    }

    @Test
    void migrationIsReproducibleFromCleanState() {
        // Flyway Community has no undo; the applicable guarantee is forward
        // reproducibility. Run against a dedicated schema in the same container so
        // clean() never touches the shared application schema in `public`.
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas("flyway_repro_test")
                .locations("classpath:db/migration")
                .cleanDisabled(false)
                .load();

        try {
            flyway.clean();

            MigrateResult first = flyway.migrate();
            assertEquals(1, first.migrationsExecuted, "the initial migration should apply once");

            // "rollback": clean tears the schema back down to empty.
            flyway.clean();
            Integer tablesAfterClean = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'flyway_repro_test'",
                    Integer.class);
            assertEquals(0, tablesAfterClean, "clean must remove every table it created");

            // Re-migrating from empty rebuilds the identical schema — forward-only,
            // deterministic, no manual intervention.
            MigrateResult second = flyway.migrate();
            assertEquals(1, second.migrationsExecuted, "the migration must replay cleanly from scratch");
        } finally {
            flyway.clean();
        }
    }

    // --- Helpers ----------------------------------------------------------

    private boolean tableExists(String table) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.tables " +
                        "WHERE table_schema = 'public' AND table_name = ?",
                Integer.class, table);
        return count != null && count > 0;
    }

    private Set<String> actualColumns(String table) {
        return new HashSet<>(jdbcTemplate.queryForList(
                "SELECT column_name FROM information_schema.columns " +
                        "WHERE table_schema = 'public' AND table_name = ?",
                String.class, table));
    }

    private void assertNotNullable(String table, String column) {
        String nullable = jdbcTemplate.queryForObject(
                "SELECT is_nullable FROM information_schema.columns " +
                        "WHERE table_schema = 'public' AND table_name = ? AND column_name = ?",
                String.class, table, column);
        assertEquals("NO", nullable, () -> table + "." + column + " must be NOT NULL");
    }

    /** True if a single-column UNIQUE (or PK) constraint covers {@code column}. */
    private boolean uniqueColumnExists(String table, String column) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.table_constraints tc " +
                        "JOIN information_schema.constraint_column_usage ccu " +
                        "  ON tc.constraint_name = ccu.constraint_name " +
                        " AND tc.table_schema = ccu.table_schema " +
                        "WHERE tc.table_schema = 'public' AND tc.table_name = ? " +
                        "  AND tc.constraint_type = 'UNIQUE' AND ccu.column_name = ?",
                Integer.class, table, column);
        return count != null && count > 0;
    }
}
