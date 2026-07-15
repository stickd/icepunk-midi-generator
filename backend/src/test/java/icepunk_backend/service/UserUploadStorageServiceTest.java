package icepunk_backend.service;

import icepunk_backend.exception.StorageException;
import icepunk_backend.exception.StorageTimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.core.exception.ApiCallTimeoutException;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.ByteArrayInputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class UserUploadStorageServiceTest {

    private static final String BUCKET = "icepunk-zips";
    private final S3Client s3Client = mock(S3Client.class);
    private UserUploadStorageService service;

    @BeforeEach
    void setUp() {
        service = new UserUploadStorageService(s3Client);
        ReflectionTestUtils.setField(service, "bucket", BUCKET);
    }

    @Test
    void uploadStoresObjectUnderUserUploadPrefixAndReturnsObjectKey() throws Exception {
        UserUploadStorageService.StoredUpload upload = service.upload(
                42L,
                "lead.mid",
                "audio/midi",
                4,
                new ByteArrayInputStream(new byte[]{1, 2, 3, 4})
        );

        ArgumentCaptor<PutObjectRequest> requestCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(requestCaptor.capture(), any(RequestBody.class));

        PutObjectRequest request = requestCaptor.getValue();
        assertEquals(BUCKET, request.bucket());
        assertEquals("audio/midi", request.contentType());
        assertEquals(4, request.contentLength());
        assertTrue(request.key().matches("user_uploads/42/[0-9a-f-]{36}\\.mid"),
                "key should be user_uploads/{ownerId}/{uuid}.mid but was " + request.key());
        assertEquals(request.key(), upload.objectKey());
    }

    @Test
    void uploadConvertsS3TimeoutToStorageTimeoutException() {
        doThrow(ApiCallTimeoutException.builder().message("api call timed out").build())
                .when(s3Client)
                .putObject(any(PutObjectRequest.class), any(RequestBody.class));

        StorageTimeoutException exception = assertThrows(StorageTimeoutException.class, () -> service.upload(
                42L,
                "lead.mid",
                "audio/midi",
                1,
                new ByteArrayInputStream(new byte[]{1})
        ));

        assertEquals("File upload timed out. Please try again.", exception.getMessage());
    }

    @Test
    void uploadConvertsS3FailureToStorageException() {
        doThrow(SdkClientException.builder().message("connection reset").build())
                .when(s3Client)
                .putObject(any(PutObjectRequest.class), any(RequestBody.class));

        StorageException exception = assertThrows(StorageException.class, () -> service.upload(
                42L,
                "lead.mid",
                "audio/midi",
                1,
                new ByteArrayInputStream(new byte[]{1})
        ));

        assertEquals("File upload failed. Please try again.", exception.getMessage());
    }
}
