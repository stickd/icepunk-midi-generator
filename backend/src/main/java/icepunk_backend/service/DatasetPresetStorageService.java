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

import java.nio.file.Path;
import java.util.UUID;

@Service
public class DatasetPresetStorageService {

    private static final Logger log = LoggerFactory.getLogger(DatasetPresetStorageService.class);
    public static final String DATASET_PRESET_PREFIX = "dataset_presets/";

    private final S3Client s3Client;
    private final String bucket;

    public DatasetPresetStorageService(
            S3Client s3Client,
            @Value("${s3.bucket}") String bucket
    ) {
        this.s3Client = s3Client;
        this.bucket = bucket;
    }

    public String uploadAnalysis(Path analysisJsonPath) {
        String key = DATASET_PRESET_PREFIX + UUID.randomUUID() + ".json";

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType("application/json")
                .build();

        try {
            s3Client.putObject(request, RequestBody.fromFile(analysisJsonPath));
        } catch (ApiCallTimeoutException | ApiCallAttemptTimeoutException exception) {
            log.warn("Dataset preset upload timed out for bucket={} key={}: {}", bucket, key, exception.getMessage());
            throw new StorageTimeoutException("Dataset upload timed out. Please try again.");
        } catch (SdkException exception) {
            log.error("Dataset preset upload failed for bucket={} key={}: {}", bucket, key, exception.getMessage());
            throw new StorageException("Dataset upload failed. Please try again.");
        }

        return key;
    }

    public byte[] readObject(String objectKey) {
        try {
            ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build());
            return response.asByteArray();
        } catch (ApiCallTimeoutException | ApiCallAttemptTimeoutException exception) {
            log.warn("Dataset preset download timed out for bucket={} key={}: {}", bucket, objectKey, exception.getMessage());
            throw new StorageTimeoutException("Dataset download timed out. Please try again.");
        } catch (SdkException exception) {
            log.error("Dataset preset download failed for bucket={} key={}: {}", bucket, objectKey, exception.getMessage());
            throw new StorageException("Dataset download failed. Please try again.");
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
            log.warn("Failed to clean dataset preset object bucket={} key={}: {}", bucket, objectKey, exception.getMessage());
        }
    }
}
