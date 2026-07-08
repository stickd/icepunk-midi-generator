package icepunk_backend.service;

import icepunk_backend.exception.StorageException;
import icepunk_backend.exception.StorageTimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.exception.ApiCallTimeoutException;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DatasetPresetStorageServiceTest {

    private static final String BUCKET = "icepunk-zips";

    @TempDir
    Path tempDir;

    private final S3Client s3Client = mock(S3Client.class);
    private DatasetPresetStorageService service;

    @BeforeEach
    void setUp() {
        service = new DatasetPresetStorageService(s3Client, BUCKET);
    }

    @Test
    void uploadAnalysisStoresObjectUnderDatasetPresetPrefix() throws Exception {
        Path analysisFile = tempDir.resolve("analysis.json");
        Files.writeString(analysisFile, "{}", StandardCharsets.UTF_8);

        String key = service.uploadAnalysis(analysisFile);

        ArgumentCaptor<PutObjectRequest> requestCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(requestCaptor.capture(), any(RequestBody.class));

        PutObjectRequest request = requestCaptor.getValue();
        assertEquals(BUCKET, request.bucket());
        assertEquals("application/json", request.contentType());
        assertTrue(key.matches("dataset_presets/[0-9a-f-]{36}\\.json"), "key was " + key);
        assertEquals(key, request.key());
    }

    @Test
    void uploadAnalysisConvertsS3TimeoutToStorageTimeoutException(@TempDir Path dir) throws Exception {
        Path analysisFile = dir.resolve("analysis.json");
        Files.writeString(analysisFile, "{}", StandardCharsets.UTF_8);
        doThrow(ApiCallTimeoutException.builder().message("api call timed out").build())
                .when(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));

        StorageTimeoutException exception = assertThrows(
                StorageTimeoutException.class,
                () -> service.uploadAnalysis(analysisFile)
        );

        assertEquals("Dataset upload timed out. Please try again.", exception.getMessage());
    }

    @Test
    void uploadAnalysisConvertsS3FailureToStorageException(@TempDir Path dir) throws Exception {
        Path analysisFile = dir.resolve("analysis.json");
        Files.writeString(analysisFile, "{}", StandardCharsets.UTF_8);
        doThrow(SdkClientException.builder().message("connection reset").build())
                .when(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));

        StorageException exception = assertThrows(
                StorageException.class,
                () -> service.uploadAnalysis(analysisFile)
        );

        assertEquals("Dataset upload failed. Please try again.", exception.getMessage());
    }

    @Test
    void readObjectReturnsBytesFromS3() {
        byte[] payload = "{\"files\":[]}".getBytes(StandardCharsets.UTF_8);
        @SuppressWarnings("unchecked")
        ResponseBytes<GetObjectResponse> response = mock(ResponseBytes.class);
        when(response.asByteArray()).thenReturn(payload);
        when(s3Client.getObjectAsBytes(any(GetObjectRequest.class))).thenReturn(response);

        byte[] result = service.readObject("dataset_presets/key.json");

        assertArrayEquals(payload, result);
    }

    @Test
    void readObjectConvertsS3TimeoutToStorageTimeoutException() {
        when(s3Client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenThrow(ApiCallTimeoutException.builder().message("api call timed out").build());

        assertThrows(StorageTimeoutException.class, () -> service.readObject("dataset_presets/key.json"));
    }

    @Test
    void readObjectConvertsS3FailureToStorageException() {
        when(s3Client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenThrow(SdkClientException.builder().message("connection reset").build());

        assertThrows(StorageException.class, () -> service.readObject("dataset_presets/key.json"));
    }

    @Test
    void deleteObjectQuietlyIgnoresBlankKey() {
        service.deleteObjectQuietly(" ");
        service.deleteObjectQuietly(null);

        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void deleteObjectQuietlySwallowsS3Failure() {
        doThrow(SdkClientException.builder().message("boom").build())
                .when(s3Client).deleteObject(any(DeleteObjectRequest.class));

        service.deleteObjectQuietly("dataset_presets/key.json");

        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
    }
}
