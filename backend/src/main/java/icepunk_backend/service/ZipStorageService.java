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
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.file.Path;
import java.util.UUID;

@Service
public class ZipStorageService {

    private static final Logger log = LoggerFactory.getLogger(ZipStorageService.class);
    static final String GENERATED_ZIP_PREFIX = "generated_midi/";

    private final S3Client s3Client;

    @Value("${s3.bucket}")
    private String bucket;

    @Value("${s3.public-url}")
    private String publicUrl;

    public ZipStorageService(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    public String uploadZip(Path zipPath) {
        String key = GENERATED_ZIP_PREFIX + UUID.randomUUID() + ".zip";

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType("application/zip")
                .build();

        try {
            s3Client.putObject(request, RequestBody.fromFile(zipPath));
        } catch (ApiCallTimeoutException | ApiCallAttemptTimeoutException exception) {
            log.warn("S3 upload timed out for bucket={} key={}: {}", bucket, key, exception.getMessage());
            throw new StorageTimeoutException("MIDI pack upload timed out. Please try again.");
        } catch (SdkException exception) {
            log.error("S3 upload failed for bucket={} key={}: {}", bucket, key, exception.getMessage());
            throw new StorageException("MIDI pack upload failed. Please try again.");
        }

        return publicUrl + "/" + key;
    }
}
