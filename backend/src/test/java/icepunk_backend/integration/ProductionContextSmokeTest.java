package icepunk_backend.integration;

import icepunk_backend.BackendApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.containers.PostgreSQLContainer;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Starts the complete production Spring context against disposable PostgreSQL and
 * MinIO services. Dynamic properties supply every production-only secret and
 * endpoint, so this CI test cannot access live credentials.
 */
@ActiveProfiles("prod")
@SpringBootTest(classes = BackendApplication.class)
class ProductionContextSmokeTest {

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    static final MinIOContainer MINIO = new MinIOContainer("minio/minio");

    static {
        POSTGRES.start();
        MINIO.start();
    }

    @DynamicPropertySource
    static void productionProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", POSTGRES::getDriverClassName);
        registry.add("jwt.secret", () -> "production-smoke-test-secret-at-least-32-bytes");
        registry.add("jwt.expiration", () -> "86400000");
        registry.add("app.cors.allowed-origins", () -> "https://smoke-test.example");
        registry.add("app.proxy.trusted-proxies", () -> "172.30.0.0/24");
        registry.add("s3.endpoint", MINIO::getS3URL);
        registry.add("s3.presign-endpoint", MINIO::getS3URL);
        registry.add("s3.region", () -> "eu-central-1");
        registry.add("s3.bucket", () -> "production-smoke-test");
        registry.add("s3.access-key", MINIO::getUserName);
        registry.add("s3.secret-key", MINIO::getPassword);
        registry.add("s3.connection-timeout-seconds", () -> "3");
        registry.add("s3.socket-timeout-seconds", () -> "15");
        registry.add("s3.api-call-timeout-seconds", () -> "30");
        registry.add("s3.api-call-attempt-timeout-seconds", () -> "20");
        registry.add("icepunk.generator.project-dir", () -> System.getProperty("user.dir") + "/..");
        registry.add("icepunk.generator.python-path", () -> "python3");
        registry.add("icepunk.generator.script-name", () -> "python/generate_midi.py");
        registry.add("icepunk.generator.temp-analyzer-script-name", () -> "python/temp_analyzer.py");
        registry.add("icepunk.generator.timeout-seconds", () -> "60");
        registry.add("icepunk.generator.max-concurrent", () -> "2");
        registry.add("generated.zip.retention-days", () -> "2");
        registry.add("uploads.midi.max-size-bytes", () -> "2097152");
        registry.add("uploads.sample.max-size-bytes", () -> "20971520");
    }

    @Autowired
    private ApplicationContext context;

    @Test
    void productionApplicationContextLoads() {
        assertNotNull(context.getBean("securityFilterChain"));
        assertTrue(context.getEnvironment().acceptsProfiles("prod"));
    }
}
