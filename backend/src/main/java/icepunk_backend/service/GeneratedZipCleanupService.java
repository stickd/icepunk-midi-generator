package icepunk_backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class GeneratedZipCleanupService {

    private static final Logger log = LoggerFactory.getLogger(GeneratedZipCleanupService.class);
    private static final long DEFAULT_RETENTION_DAYS = 2;

    private final S3Client s3Client;
    private final String bucket;
    private final long retentionDays;
    private final Clock clock;

    @Autowired
    public GeneratedZipCleanupService(
            S3Client s3Client,
            @Value("${s3.bucket}") String bucket,
            @Value("${generated.zip.retention-days}") long retentionDays
    ) {
        this(s3Client, bucket, retentionDays, Clock.systemUTC());
    }

    GeneratedZipCleanupService(S3Client s3Client, String bucket, long retentionDays, Clock clock) {
        this.s3Client = s3Client;
        this.bucket = bucket;
        this.retentionDays = retentionDays > 0 ? retentionDays : DEFAULT_RETENTION_DAYS;
        this.clock = clock;
    }

    @Scheduled(initialDelayString = "${generated.zip.cleanup.initial-delay-ms:60000}",
            fixedDelayString = "${generated.zip.cleanup.fixed-delay-ms:86400000}")
    public void cleanupOldGeneratedZips() {
        Instant cutoff = Instant.now(clock).minus(retentionDays, ChronoUnit.DAYS);
        int deleted = 0;
        int failures = 0;
        String continuationToken = null;

        try {
            do {
                ListObjectsV2Response response = s3Client.listObjectsV2(ListObjectsV2Request.builder()
                        .bucket(bucket)
                        .prefix(GeneratedPackStorageService.GENERATED_ZIP_PREFIX)
                        .continuationToken(continuationToken)
                        .build());

                for (S3Object object : response.contents()) {
                    if (!shouldDelete(object, cutoff)) {
                        continue;
                    }

                    try {
                        s3Client.deleteObject(DeleteObjectRequest.builder()
                                .bucket(bucket)
                                .key(object.key())
                                .build());
                        deleted++;
                    } catch (SdkException exception) {
                        failures++;
                        log.warn("Failed to delete generated ZIP key={} bucket={}: {}",
                                object.key(), bucket, exception.getMessage());
                    }
                }

                continuationToken = response.nextContinuationToken();
            } while (continuationToken != null);

            log.info("Generated ZIP cleanup completed: deleted={} failures={} retentionDays={} prefix={}",
                    deleted, failures, retentionDays, GeneratedPackStorageService.GENERATED_ZIP_PREFIX);
        } catch (RuntimeException exception) {
            log.warn("Generated ZIP cleanup failed for bucket={} prefix={}: {}",
                    bucket, GeneratedPackStorageService.GENERATED_ZIP_PREFIX, exception.getMessage());
        }
    }

    private boolean shouldDelete(S3Object object, Instant cutoff) {
        return object.key() != null
                && object.key().startsWith(GeneratedPackStorageService.GENERATED_ZIP_PREFIX)
                && object.lastModified() != null
                && object.lastModified().isBefore(cutoff);
    }
}
