package icepunk_backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.core.exception.ApiCallTimeoutException;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import icepunk_backend.exception.StorageException;
import icepunk_backend.exception.StorageTimeoutException;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/*
 * | EP                  | Expected                                                  |
 * |---------------------|-----------------------------------------------------------|
 * | S3 key format       | "zips/{uuid}.zip"                                         |
 * | content type        | "application/zip"                                        |
 * | bucket param        | configured s3.bucket                                     |
 * | returned public URL | "{s3.public-url}/{key}"                                  |
 */
class ZipStorageServiceTest {

    private static final String BUCKET = "icepunk-zips";
    private static final String PUBLIC_URL = "https://cdn.example.com";

    private final S3Client s3Client = mock(S3Client.class);
    private ZipStorageService service;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        service = new ZipStorageService(s3Client);
        ReflectionTestUtils.setField(service, "bucket", BUCKET);
        ReflectionTestUtils.setField(service, "publicUrl", PUBLIC_URL);
    }

    @Test
    void uploadZipPutsObjectWithCorrectKeyContentTypeAndBucket() throws Exception {
        Path zip = Files.writeString(tempDir.resolve("pack.zip"), "zip-bytes");

        String url = service.uploadZip(zip);

        ArgumentCaptor<PutObjectRequest> requestCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(requestCaptor.capture(), any(RequestBody.class));

        PutObjectRequest request = requestCaptor.getValue();
        assertEquals(BUCKET, request.bucket());
        assertEquals("application/zip", request.contentType());
        assertTrue(request.key().matches("zips/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.zip"),
                "key should be zips/{uuid}.zip but was " + request.key());
        assertEquals(PUBLIC_URL + "/" + request.key(), url);
    }

    @Test
    void uploadZipConvertsS3TimeoutToStorageTimeoutException() throws Exception {
        Path zip = Files.writeString(tempDir.resolve("pack.zip"), "zip-bytes");
        doThrow(ApiCallTimeoutException.builder().message("api call timed out").build())
                .when(s3Client)
                .putObject(any(PutObjectRequest.class), any(RequestBody.class));

        StorageTimeoutException exception = assertThrows(StorageTimeoutException.class, () -> service.uploadZip(zip));

        assertEquals("MIDI pack upload timed out. Please try again.", exception.getMessage());
    }

    @Test
    void uploadZipConvertsS3FailureToStorageException() throws Exception {
        Path zip = Files.writeString(tempDir.resolve("pack.zip"), "zip-bytes");
        doThrow(SdkClientException.builder().message("connection reset").build())
                .when(s3Client)
                .putObject(any(PutObjectRequest.class), any(RequestBody.class));

        StorageException exception = assertThrows(StorageException.class, () -> service.uploadZip(zip));

        assertEquals("MIDI pack upload failed. Please try again.", exception.getMessage());
    }
}
