package icepunk_backend.service;

import icepunk_backend.exception.StorageException;
import icepunk_backend.exception.StorageTimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.exception.ApiCallAttemptTimeoutException;
import software.amazon.awssdk.core.exception.ApiCallTimeoutException;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;

@Service
public class GeneratedPackStorageService {

    private static final Logger log = LoggerFactory.getLogger(GeneratedPackStorageService.class);
    public static final String GENERATED_ZIP_PREFIX = "generated_midi/";
    public static final String GENERATED_ITEM_PREFIX = "generated_midi_items/";

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucket;

    public GeneratedPackStorageService(
            S3Client s3Client,
            S3Presigner s3Presigner,
            @Value("${s3.bucket}") String bucket
    ) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.bucket = bucket;
    }

    /** Retained for storage tests that exercise upload/read behavior only. */
    public GeneratedPackStorageService(S3Client s3Client, String bucket) {
        this(s3Client, null, bucket);
    }

    public StoredObject uploadZip(Path zipPath) {
        return upload(zipPath, GENERATED_ZIP_PREFIX + UUID.randomUUID() + ".zip", "application/zip");
    }

    public StoredObject uploadMidi(Path midiPath) {
        return upload(midiPath, GENERATED_ITEM_PREFIX + UUID.randomUUID() + ".mid", "audio/midi");
    }

    public byte[] readObject(String objectKey) {
        try {
            ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build());
            return response.asByteArray();
        } catch (ApiCallTimeoutException | ApiCallAttemptTimeoutException exception) {
            log.warn("Generated object download timed out for bucket={} key={}: {}", bucket, objectKey, exception.getMessage());
            throw new StorageTimeoutException("Generated MIDI download timed out. Please try again.");
        } catch (SdkException exception) {
            log.error("Generated object download failed for bucket={} key={}: {}", bucket, objectKey, exception.getMessage());
            throw new StorageException("Generated MIDI download failed. Please try again.");
        }
    }

    public void deleteObjectQuietly(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }

        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build());
        } catch (RuntimeException exception) {
            log.warn("Failed to clean generated object bucket={} key={}: {}", bucket, objectKey, exception.getMessage());
        }
    }

    private StoredObject upload(Path path, String key, String contentType) {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build();

        try {
            s3Client.putObject(request, RequestBody.fromFile(path));
        } catch (ApiCallTimeoutException | ApiCallAttemptTimeoutException exception) {
            log.warn("Generated object upload timed out for bucket={} key={}: {}", bucket, key, exception.getMessage());
            throw new StorageTimeoutException("Generated MIDI upload timed out. Please try again.");
        } catch (SdkException exception) {
            log.error("Generated object upload failed for bucket={} key={}: {}", bucket, key, exception.getMessage());
            throw new StorageException("Generated MIDI upload failed. Please try again.");
        }

        return new StoredObject(key);
    }

    public String createPresignedGetUrl(
            String objectKey,
            Duration ttl,
            String contentType,
            String contentDisposition
    ) {
        if (s3Presigner == null) {
            throw new IllegalStateException("S3 presigner is not configured");
        }
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .responseContentType(contentType)
                .responseContentDisposition(contentDisposition)
                .build();

        return s3Presigner.presignGetObject(GetObjectPresignRequest.builder()
                        .signatureDuration(ttl)
                        .getObjectRequest(getObjectRequest)
                        .build())
                .url()
                .toExternalForm();
    }

    public record StoredObject(String objectKey) {
    }
}
