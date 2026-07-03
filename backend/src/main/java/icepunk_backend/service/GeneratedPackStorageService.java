package icepunk_backend.service;

import icepunk_backend.exception.StorageException;
import icepunk_backend.exception.StorageTimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.exception.ApiCallAttemptTimeoutException;
import software.amazon.awssdk.core.exception.ApiCallTimeoutException;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.file.Path;
import java.util.UUID;

@Service
public class GeneratedPackStorageService {

    private static final Logger log = LoggerFactory.getLogger(GeneratedPackStorageService.class);
    public static final String GENERATED_ZIP_PREFIX = "generated_midi/";
    public static final String GENERATED_ITEM_PREFIX = "generated_midi_items/";

    private final S3Client s3Client;
    private final String bucket;
    private final String publicUrl;

    public GeneratedPackStorageService(
            S3Client s3Client,
            @Value("${s3.bucket}") String bucket,
            @Value("${s3.public-url}") String publicUrl
    ) {
        this.s3Client = s3Client;
        this.bucket = bucket;
        this.publicUrl = publicUrl;
    }

    public StoredObject uploadZip(Path zipPath) {
        return upload(zipPath, GENERATED_ZIP_PREFIX + UUID.randomUUID() + ".zip", "application/zip");
    }

    public StoredObject uploadMidi(Path midiPath) {
        return upload(midiPath, GENERATED_ITEM_PREFIX + UUID.randomUUID() + ".mid", "audio/midi");
    }

    public String publicUrlForObjectKey(String objectKey) {
        return publicUrl + "/" + objectKey;
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

        return new StoredObject(key, publicUrlForObjectKey(key));
    }

    public record StoredObject(String objectKey, String publicUrl) {
    }
}
