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
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

import java.net.URI;

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

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withPassword("production-smoke-postgres-password-at-least-32");
    static final MinIOContainer MINIO = new MinIOContainer(DockerImageName
            .parse("dappros/minio:RELEASE.2025-09-07T16-13-09Z")
            .asCompatibleSubstituteFor("minio/minio"))
            .withEnv("MINIO_ROOT_USER", "smoke-minio-root")
            .withEnv("MINIO_ROOT_PASSWORD", "production-smoke-minio-password-at-least-32");

    static {
        POSTGRES.start();
        MINIO.start();
        try (S3Client client = S3Client.builder()
                .endpointOverride(URI.create(MINIO.getS3URL()))
                .region(Region.of("eu-central-1"))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(
                        "smoke-minio-root", "production-smoke-minio-password-at-least-32")))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build()) {
            client.createBucket(request -> request.bucket("production-smoke-test"));
        }
    }

    @DynamicPropertySource
    static void productionProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", POSTGRES::getDriverClassName);
        // application-test.properties disables Flyway for H2-based unit tests.
        // This smoke test uses a disposable real PostgreSQL instance and validates
        // the production schema, so the production migrations must run first.
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("jwt.secret", () -> "production-smoke-test-secret-at-least-32-bytes");
        registry.add("jwt.expiration", () -> "86400000");
        registry.add("auth.rate-limit.login-ip-limit", () -> "5");
        registry.add("auth.rate-limit.login-identifier-limit", () -> "5");
        registry.add("auth.rate-limit.login-window-seconds", () -> "900");
        registry.add("auth.rate-limit.register-ip-limit", () -> "3");
        registry.add("auth.rate-limit.register-email-limit", () -> "3");
        registry.add("auth.rate-limit.register-window-seconds", () -> "3600");
        registry.add("email.verification.resend-limit", () -> "3");
        registry.add("email.verification.resend-window-minutes", () -> "15");
        registry.add("app.cors.allowed-origins", () -> "https://smoke-test.example");
        registry.add("app.proxy.trusted-proxies", () -> "172.30.0.0/24");
        registry.add("s3.endpoint", MINIO::getS3URL);
        registry.add("s3.presign-endpoint", MINIO::getS3URL);
        registry.add("s3.region", () -> "eu-central-1");
        registry.add("s3.bucket", () -> "production-smoke-test");
        registry.add("s3.access-key", () -> "smoke-minio-root");
        registry.add("s3.secret-key", () -> "production-smoke-minio-password-at-least-32");
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
