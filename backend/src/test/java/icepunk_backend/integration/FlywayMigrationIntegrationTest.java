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

    /** Every versioned migration currently in db/migration. */
    private static final int EXPECTED_MIGRATION_COUNT = 3;

    /** Expected table → column set, mirroring the JPA entities. */
    private static final Map<String, Set<String>> EXPECTED_COLUMNS = Map.of(
            "users", Set.of(
                    "id", "username", "email", "password_hash",
                    "generations_today", "generation_date",
                    "bio", "credits", "verified", "created_at"),
            "generation_stats", Set.of(
                    "id", "total_generations"),
            "guest_usage", Set.of(
                    "id", "ip_address", "generations_today", "generation_date"),
            "user_uploaded_projects", Set.of(
                    "id", "owner_id", "title", "midi_object_key", "sample_object_key",
                    "uploaded_at", "visibility", "metadata", "download_count"),
            "project_likes", Set.of(
                    "user_id", "project_id", "created_at")
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

        assertEquals(EXPECTED_MIGRATION_COUNT, history.size(),
                "exactly " + EXPECTED_MIGRATION_COUNT + " versioned migrations are expected");
        for (int i = 0; i < EXPECTED_MIGRATION_COUNT; i++) {
            assertEquals(String.valueOf(i + 1), history.get(i).get("version"));
            assertEquals(Boolean.TRUE, history.get(i).get("success"), "the migration must be marked successful");
        }

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
        assertNotNullable("user_uploaded_projects", "owner_id");
        assertNotNullable("user_uploaded_projects", "title");
        assertNotNullable("user_uploaded_projects", "midi_object_key");
        assertNotNullable("user_uploaded_projects", "uploaded_at");
        assertNotNullable("user_uploaded_projects", "visibility");
        assertNotNullable("user_uploaded_projects", "metadata");

        // Unique constraints that back the entity's @UniqueConstraint / unique = true.
        assertTrue(uniqueColumnExists("users", "email"), "users.email must be unique");
        assertTrue(uniqueColumnExists("users", "username"), "users.username must be unique");
        assertTrue(uniqueColumnExists("guest_usage", "ip_address"), "guest_usage.ip_address must be unique");
        assertTrue(uniqueColumnExists("user_uploaded_projects", "midi_object_key"),
                "user_uploaded_projects.midi_object_key must be unique");

        assertTrue(foreignKeyExists("user_uploaded_projects", "owner_id", "users", "id"),
                "uploaded projects must reference their owner user");
        assertTrue(checkConstraintExists("user_uploaded_projects", "ck_user_uploaded_projects_visibility"),
                "visibility must be constrained to supported states");
        assertTrue(checkConstraintExists("user_uploaded_projects", "ck_user_uploaded_projects_title_not_blank"),
                "blank upload titles must be rejected");
        assertTrue(checkConstraintExists("user_uploaded_projects", "ck_user_uploaded_projects_metadata_object"),
                "metadata must be constrained to a JSON object");
        assertTrue(indexExists("idx_user_uploaded_projects_owner_id"),
                "owner lookup index must exist");
        assertTrue(indexExists("idx_user_uploaded_projects_owner_uploaded_at"),
                "owner library sort index must exist");
        assertTrue(indexExists("idx_user_uploaded_projects_visibility_uploaded_at"),
                "visibility discovery index must exist");
        assertTrue(indexExists("idx_user_uploaded_projects_metadata"),
                "metadata GIN index must exist");

        // V3 — profiles & engagement.
        assertNotNullable("users", "credits");
        assertNotNullable("users", "verified");
        assertNotNullable("users", "created_at");
        assertNotNullable("user_uploaded_projects", "download_count");
        assertNotNullable("project_likes", "user_id");
        assertNotNullable("project_likes", "project_id");
        assertNotNullable("project_likes", "created_at");
        assertTrue(foreignKeyExists("project_likes", "user_id", "users", "id"),
                "likes must reference the liking user");
        assertTrue(foreignKeyExists("project_likes", "project_id", "user_uploaded_projects", "id"),
                "likes must reference the liked project");
        assertTrue(indexExists("idx_project_likes_project_id"),
                "per-project like count index must exist");
        assertTrue(indexExists("idx_project_likes_user_created_at"),
                "per-user favorites sort index must exist");
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
            assertEquals(EXPECTED_MIGRATION_COUNT, first.migrationsExecuted, "all migrations should apply once");

            // "rollback": clean tears the schema back down to empty.
            flyway.clean();
            Integer tablesAfterClean = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'flyway_repro_test'",
                    Integer.class);
            assertEquals(0, tablesAfterClean, "clean must remove every table it created");

            // Re-migrating from empty rebuilds the identical schema — forward-only,
            // deterministic, no manual intervention.
            MigrateResult second = flyway.migrate();
            assertEquals(EXPECTED_MIGRATION_COUNT, second.migrationsExecuted,
                    "the migrations must replay cleanly from scratch");
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

    private boolean foreignKeyExists(String table, String column, String foreignTable, String foreignColumn) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.table_constraints tc " +
                        "JOIN information_schema.key_column_usage kcu " +
                        "  ON tc.constraint_name = kcu.constraint_name " +
                        " AND tc.table_schema = kcu.table_schema " +
                        "JOIN information_schema.constraint_column_usage ccu " +
                        "  ON tc.constraint_name = ccu.constraint_name " +
                        " AND tc.table_schema = ccu.table_schema " +
                        "WHERE tc.table_schema = 'public' AND tc.table_name = ? " +
                        "  AND tc.constraint_type = 'FOREIGN KEY' " +
                        "  AND kcu.column_name = ? AND ccu.table_name = ? AND ccu.column_name = ?",
                Integer.class, table, column, foreignTable, foreignColumn);
        return count != null && count > 0;
    }

    private boolean checkConstraintExists(String table, String constraint) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.table_constraints " +
                        "WHERE table_schema = 'public' AND table_name = ? " +
                        "  AND constraint_type = 'CHECK' AND constraint_name = ?",
                Integer.class, table, constraint);
        return count != null && count > 0;
    }

    private boolean indexExists(String index) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = ?",
                Integer.class, index);
        return count != null && count > 0;
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
