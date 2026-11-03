package icepunk_backend.integration;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base class for integration tests that exercise real PostgreSQL behaviour
 * (unique constraints, {@code SELECT ... FOR UPDATE} row locks) which H2 cannot
 * faithfully reproduce.
 *
 * <p>Uses the Testcontainers <em>singleton container</em> pattern: the container
 * is started once in a static initializer and is never stopped between test
 * classes (Ryuk reaps it at JVM exit). This is deliberate — Spring caches and
 * reuses the application context across these identically-configured test
 * classes, so the container backing that cached context must outlive any single
 * class. The {@code @Container}/{@code @Testcontainers} lifecycle would stop the
 * container in the first class's {@code afterAll}, leaving the reused context
 * pointing at a dead port.
 *
 * <p>The container's JDBC coordinates are injected with
 * {@link DynamicPropertySource}, which has the highest property precedence and
 * therefore overrides the H2 datasource configured by the {@code test} profile
 * in {@code application-test.properties}. Flyway is re-enabled and ddl-auto
 * switched to {@code validate} so the schema is built from the real migration
 * scripts, exactly as it is in production.
 */
@SpringBootTest
public abstract class AbstractPostgresContainerTest {

    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void overrideDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", POSTGRES::getDriverClassName);

        // Build the schema from the production migrations rather than H2 ddl-auto.
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }
}
