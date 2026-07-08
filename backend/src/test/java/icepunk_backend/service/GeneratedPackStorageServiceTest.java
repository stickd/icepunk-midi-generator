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

class GeneratedPackStorageServiceTest {

    private static final String BUCKET = "icepunk-zips";
    private static final String PUBLIC_URL = "https://cdn.example.com";

    @TempDir
    Path tempDir;

    private final S3Client s3Client = mock(S3Client.class);
    private GeneratedPackStorageService service;

    @BeforeEach
    void setUp() {
        service = new GeneratedPackStorageService(s3Client, BUCKET, PUBLIC_URL);
    }

    @Test
    void uploadZipStoresObjectUnderGeneratedMidiPrefixAndReturnsPublicUrl() throws Exception {
        Path zipFile = tempDir.resolve("pack.zip");
        Files.write(zipFile, new byte[]{1, 2, 3});

        GeneratedPackStorageService.StoredObject stored = service.uploadZip(zipFile);

        ArgumentCaptor<PutObjectRequest> requestCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(requestCaptor.capture(), any(RequestBody.class));

        PutObjectRequest request = requestCaptor.getValue();
        assertEquals(BUCKET, request.bucket());
        assertEquals("application/zip", request.contentType());
        assertTrue(stored.objectKey().matches("generated_midi/[0-9a-f-]{36}\\.zip"), "key was " + stored.objectKey());
        assertEquals(PUBLIC_URL + "/" + stored.objectKey(), stored.publicUrl());
    }

    @Test
    void uploadMidiStoresObjectUnderGeneratedMidiItemsPrefix() throws Exception {
        Path midiFile = tempDir.resolve("item.mid");
        Files.write(midiFile, new byte[]{4, 5, 6});

        GeneratedPackStorageService.StoredObject stored = service.uploadMidi(midiFile);

        ArgumentCaptor<PutObjectRequest> requestCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(requestCaptor.capture(), any(RequestBody.class));

        assertEquals("audio/midi", requestCaptor.getValue().contentType());
        assertTrue(stored.objectKey().matches("generated_midi_items/[0-9a-f-]{36}\\.mid"), "key was " + stored.objectKey());
        assertEquals(PUBLIC_URL + "/" + stored.objectKey(), stored.publicUrl());
    }

    @Test
    void uploadConvertsS3TimeoutToStorageTimeoutException() throws Exception {
        Path zipFile = tempDir.resolve("pack.zip");
        Files.write(zipFile, new byte[]{1});
        doThrow(ApiCallTimeoutException.builder().message("api call timed out").build())
                .when(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));

        StorageTimeoutException exception = assertThrows(
                StorageTimeoutException.class,
                () -> service.uploadZip(zipFile)
        );

        assertEquals("Generated MIDI upload timed out. Please try again.", exception.getMessage());
    }

    @Test
    void uploadConvertsS3FailureToStorageException() throws Exception {
        Path zipFile = tempDir.resolve("pack.zip");
        Files.write(zipFile, new byte[]{1});
        doThrow(SdkClientException.builder().message("connection reset").build())
                .when(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));

        StorageException exception = assertThrows(
                StorageException.class,
                () -> service.uploadZip(zipFile)
        );

        assertEquals("Generated MIDI upload failed. Please try again.", exception.getMessage());
    }

    @Test
    void publicUrlForObjectKeyJoinsBaseUrlAndKey() {
        assertEquals(PUBLIC_URL + "/generated_midi/abc.zip", service.publicUrlForObjectKey("generated_midi/abc.zip"));
    }

    @Test
    void readObjectReturnsBytesFromS3() {
        byte[] payload = new byte[]{9, 8, 7};
        @SuppressWarnings("unchecked")
        ResponseBytes<GetObjectResponse> response = mock(ResponseBytes.class);
        when(response.asByteArray()).thenReturn(payload);
        when(s3Client.getObjectAsBytes(any(GetObjectRequest.class))).thenReturn(response);

        assertArrayEquals(payload, service.readObject("generated_midi_items/key.mid"));
    }

    @Test
    void readObjectConvertsS3TimeoutToStorageTimeoutException() {
        when(s3Client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenThrow(ApiCallTimeoutException.builder().message("api call timed out").build());

        assertThrows(StorageTimeoutException.class, () -> service.readObject("generated_midi/key.zip"));
    }

    @Test
    void readObjectConvertsS3FailureToStorageException() {
        when(s3Client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenThrow(SdkClientException.builder().message("connection reset").build());

        assertThrows(StorageException.class, () -> service.readObject("generated_midi/key.zip"));
    }

    @Test
    void deleteObjectQuietlyIgnoresBlankKey() {
        service.deleteObjectQuietly("");
        service.deleteObjectQuietly(null);

        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void deleteObjectQuietlySwallowsS3Failure() {
        doThrow(SdkClientException.builder().message("boom").build())
                .when(s3Client).deleteObject(any(DeleteObjectRequest.class));

        service.deleteObjectQuietly("generated_midi/key.zip");

        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
    }
}
