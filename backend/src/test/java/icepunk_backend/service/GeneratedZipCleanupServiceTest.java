package icepunk_backend.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GeneratedZipCleanupServiceTest {

    private static final String BUCKET = "icepunk-zips";
    private static final Instant NOW = Instant.parse("2026-07-02T10:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private final S3Client s3Client = mock(S3Client.class);

    @Test
    void cleanupDeletesOnlyOldObjectsInsideGeneratedMidiPrefix() {
        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(ListObjectsV2Response.builder()
                .contents(
                        object("generated_midi/old.zip", NOW.minusSeconds(3 * 24 * 60 * 60)),
                        object("generated_midi/new.zip", NOW.minusSeconds(60)),
                        object("other/old.zip", NOW.minusSeconds(3 * 24 * 60 * 60)),
                        object("generated_midi/no-date.zip", null)
                )
                .isTruncated(false)
                .build());

        cleanupService(2).cleanupOldGeneratedZips();

        ArgumentCaptor<ListObjectsV2Request> listRequest = ArgumentCaptor.forClass(ListObjectsV2Request.class);
        verify(s3Client).listObjectsV2(listRequest.capture());
        assertEquals(BUCKET, listRequest.getValue().bucket());
        assertEquals("generated_midi/", listRequest.getValue().prefix());

        ArgumentCaptor<DeleteObjectRequest> deleteRequest = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(deleteRequest.capture());
        assertEquals(BUCKET, deleteRequest.getValue().bucket());
        assertEquals("generated_midi/old.zip", deleteRequest.getValue().key());
    }

    @Test
    void cleanupIsSafeWhenBucketIsEmpty() {
        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(ListObjectsV2Response.builder()
                .contents(List.of())
                .isTruncated(false)
                .build());

        assertDoesNotThrow(() -> cleanupService(2).cleanupOldGeneratedZips());

        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void cleanupDoesNotThrowWhenDeleteFails() {
        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(ListObjectsV2Response.builder()
                .contents(object("generated_midi/old.zip", NOW.minusSeconds(3 * 24 * 60 * 60)))
                .isTruncated(false)
                .build());
        doThrow(SdkClientException.builder().message("delete failed").build())
                .when(s3Client)
                .deleteObject(any(DeleteObjectRequest.class));

        assertDoesNotThrow(() -> cleanupService(2).cleanupOldGeneratedZips());

        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void cleanupUsesDefaultRetentionWhenConfiguredValueIsInvalid() {
        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(ListObjectsV2Response.builder()
                .contents(
                        object("generated_midi/two-days-old.zip", NOW.minusSeconds(2 * 24 * 60 * 60)),
                        object("generated_midi/three-days-old.zip", NOW.minusSeconds(3 * 24 * 60 * 60))
                )
                .isTruncated(false)
                .build());

        cleanupService(0).cleanupOldGeneratedZips();

        ArgumentCaptor<DeleteObjectRequest> deleteRequest = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client, times(1)).deleteObject(deleteRequest.capture());
        assertEquals("generated_midi/three-days-old.zip", deleteRequest.getValue().key());
    }

    @Test
    void cleanupDoesNotThrowWhenListingFails() {
        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class)))
                .thenThrow(SdkClientException.builder().message("list failed").build());

        assertDoesNotThrow(() -> cleanupService(2).cleanupOldGeneratedZips());

        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
    }

    private GeneratedZipCleanupService cleanupService(long retentionDays) {
        return new GeneratedZipCleanupService(s3Client, BUCKET, retentionDays, CLOCK);
    }

    private S3Object object(String key, Instant lastModified) {
        return S3Object.builder()
                .key(key)
                .lastModified(lastModified)
                .build();
    }
}
