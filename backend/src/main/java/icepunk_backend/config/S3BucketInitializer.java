package icepunk_backend.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Component
@Profile("!test")
public class S3BucketInitializer {

    private static final Logger log = LoggerFactory.getLogger(S3BucketInitializer.class);

    private final S3Client s3Client;
    private final String bucket;

    public S3BucketInitializer(S3Client s3Client, @Value("${s3.bucket}") String bucket) {
        this.s3Client = s3Client;
        this.bucket = bucket;
    }

    @PostConstruct
    public void ensureBucketExists() {
        try {
            s3Client.headBucket(b -> b.bucket(bucket));
        } catch (NoSuchBucketException exception) {
            createPrivateBucket();
        } catch (S3Exception exception) {
            if (exception.statusCode() == 404) {
                createPrivateBucket();
                return;
            }
            throw exception;
        }
    }

    private void createPrivateBucket() {
        s3Client.createBucket(b -> b.bucket(bucket));
        log.info("Auto-created private S3 bucket={}", bucket);
    }
}
