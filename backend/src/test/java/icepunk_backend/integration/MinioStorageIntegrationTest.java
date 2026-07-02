package icepunk_backend.integration;

import icepunk_backend.config.S3Config;
import icepunk_backend.exception.StorageException;
import icepunk_backend.service.ZipStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.MinIOContainer;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises the real S3 stack — the production {@link S3Config} bean wiring and
 * {@link ZipStorageService} — against a real MinIO server in a Testcontainer.
 * This is the same MinIO image the app uses locally ({@code docker-compose.yml}),
 * so path-style addressing, bucket policies and anonymous reads behave exactly as
 * they do in a deployed environment, which a mocked {@code S3Client} cannot prove.
 *
 * <p>Only the two S3 beans are loaded ({@code WebEnvironment.NONE}, no JPA), and
 * {@link DynamicPropertySource} repoints every {@code s3.*} placeholder at the
 * container, overriding the dummy values in {@code application-test.properties}.
 */
@SpringBootTest(
        classes = { S3Config.class, ZipStorageService.class },
        webEnvironment = SpringBootTest.WebEnvironment.NONE
)
class MinioStorageIntegrationTest {

    /** Matches the image used in {@code docker-compose.yml}. */
    static final MinIOContainer MINIO = new MinIOContainer("minio/minio");

    static {
        MINIO.start();
    }

    private static final String BUCKET = "icepunk-zips-test";

    @DynamicPropertySource
    static void s3Properties(DynamicPropertyRegistry registry) {
        registry.add("s3.endpoint", MINIO::getS3URL);
        registry.add("s3.region", () -> "eu-central-1");
        registry.add("s3.bucket", () -> BUCKET);
        registry.add("s3.access-key", MINIO::getUserName);
        registry.add("s3.secret-key", MINIO::getPassword);
        registry.add("s3.public-url", () -> MINIO.getS3URL() + "/" + BUCKET);
        registry.add("s3.connection-timeout-seconds", () -> "3");
        registry.add("s3.socket-timeout-seconds", () -> "15");
        registry.add("s3.api-call-timeout-seconds", () -> "30");
        registry.add("s3.api-call-attempt-timeout-seconds", () -> "20");
    }

    @Autowired
    private S3Client s3Client;

    @Autowired
    private ZipStorageService zipStorageService;

    @BeforeEach
    void ensureEmptyBucket() {
        if (!bucketExists(BUCKET)) {
            s3Client.createBucket(b -> b.bucket(BUCKET));
        }
        emptyBucket(BUCKET);
    }

    @Test
    void bucketIsCreatedAndVisible() {
        // The bucket is provisioned out-of-band in production (docker-compose / mc);
        // @BeforeEach mirrors that here. The S3 API must then report it as present.
        assertTrue(bucketExists(BUCKET), "the configured bucket must exist after provisioning");
        assertTrue(
                s3Client.listBuckets().buckets().stream()
                        .anyMatch(b -> b.name().equals(BUCKET)),
                "the bucket must appear in listBuckets");
    }

    @Test
    void uploadStoresZipUnderGeneratedMidiPrefixAndReturnsPublicUrl() throws Exception {
        Path zip = newZipFile("midi-pack-bytes");

        String url = zipStorageService.uploadZip(zip);

        String expectedPrefix = MINIO.getS3URL() + "/" + BUCKET + "/generated_midi/";
        assertTrue(url.startsWith(expectedPrefix), () -> "unexpected url: " + url);
        assertTrue(url.endsWith(".zip"), () -> "unexpected url: " + url);

        // The object actually landed in storage under the generated_midi/ prefix.
        List<S3Object> objects = listObjects(BUCKET);
        assertEquals(1, objects.size());
        assertTrue(objects.get(0).key().startsWith("generated_midi/"));
        assertTrue(objects.get(0).key().endsWith(".zip"));
    }

    @Test
    void uploadedObjectIsAnonymouslyReadableViaPublicUrl() throws Exception {
        // Grant public, unauthenticated read on the bucket — this is what makes the
        // returned download URL usable by a browser with no credentials.
        allowAnonymousReads(BUCKET);

        byte[] payload = "anonymous-download-test".getBytes(StandardCharsets.UTF_8);
        Path zip = Files.createTempFile("pack", ".zip");
        Files.write(zip, payload);

        String url = zipStorageService.uploadZip(zip);
        Files.deleteIfExists(zip);

        HttpResponse<byte[]> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(url)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());

        assertEquals(200, response.statusCode(), "public URL must be reachable without credentials");
        assertArrayEquals(payload, response.body(), "downloaded bytes must match the uploaded zip");
    }

    @Test
    void failedUploadLeavesNoObjectInStorage() throws Exception {
        // Point a throwaway service at a bucket that does not exist: the upload must
        // fail outright and leave the real bucket untouched — no orphaned object.
        ZipStorageService failing = new ZipStorageService(s3Client);
        ReflectionTestUtils.setField(failing, "bucket", "missing-bucket-" + UUID.randomUUID());
        ReflectionTestUtils.setField(failing, "publicUrl", "http://unused");

        Path zip = newZipFile("doomed");

        assertThrows(StorageException.class, () -> failing.uploadZip(zip));
        assertEquals(0, listObjects(BUCKET).size(),
                "a failed upload must not leak an object into storage");
    }

    // --- Helpers ----------------------------------------------------------

    private Path newZipFile(String content) throws Exception {
        Path zip = Files.createTempFile("pack", ".zip");
        Files.writeString(zip, content);
        zip.toFile().deleteOnExit();
        return zip;
    }

    private boolean bucketExists(String bucket) {
        try {
            s3Client.headBucket(b -> b.bucket(bucket));
            return true;
        } catch (S3Exception e) {
            return false;
        }
    }

    private List<S3Object> listObjects(String bucket) {
        return s3Client.listObjectsV2(b -> b.bucket(bucket)).contents();
    }

    private void emptyBucket(String bucket) {
        List<ObjectIdentifier> ids = listObjects(bucket).stream()
                .map(o -> ObjectIdentifier.builder().key(o.key()).build())
                .toList();
        if (!ids.isEmpty()) {
            s3Client.deleteObjects(b -> b.bucket(bucket)
                    .delete(Delete.builder().objects(ids).build()));
        }
    }

    private void allowAnonymousReads(String bucket) {
        String policy = """
                {
                  "Version": "2012-10-17",
                  "Statement": [{
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": "s3:GetObject",
                    "Resource": "arn:aws:s3:::%s/*"
                  }]
                }""".formatted(bucket);
        s3Client.putBucketPolicy(b -> b.bucket(bucket).policy(policy));
    }
}
