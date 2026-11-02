package icepunk_backend.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.GetBucketPolicyResponse;
import software.amazon.awssdk.services.s3.model.GetBucketPolicyRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Arrays;
import java.util.Iterator;
import java.util.Map;

@Component
@Profile("!test")
public class S3BucketInitializer {

    private static final Logger log = LoggerFactory.getLogger(S3BucketInitializer.class);

    private final S3Client s3Client;
    private final String bucket;
    private final Environment environment;
    private final ObjectMapper objectMapper;

    public S3BucketInitializer(
            S3Client s3Client,
            @Value("${s3.bucket}") String bucket,
            Environment environment,
            ObjectMapper objectMapper
    ) {
        this.s3Client = s3Client;
        this.bucket = bucket;
        this.environment = environment;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void ensureBucketExists() {
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
        } catch (NoSuchBucketException exception) {
            if (isProduction()) {
                throw new IllegalStateException("Configured S3 bucket is missing in production.", exception);
            }
            createPrivateBucket();
        } catch (S3Exception exception) {
            if (exception.statusCode() == 404) {
                if (isProduction()) {
                    throw new IllegalStateException("Configured S3 bucket is missing in production.", exception);
                }
                createPrivateBucket();
                return;
            }
            throw exception;
        }
        assertBucketIsPrivate();
    }

    private void createPrivateBucket() {
        s3Client.createBucket(b -> b.bucket(bucket));
        log.info("Auto-created private S3 bucket={}", bucket);
    }

    private boolean isProduction() {
        return Arrays.asList(environment.getActiveProfiles()).contains("prod");
    }

    private void assertBucketIsPrivate() {
        try {
            GetBucketPolicyResponse response = s3Client.getBucketPolicy(
                    GetBucketPolicyRequest.builder().bucket(bucket).build());
            if (response.policy() != null && permitsAnonymousAccess(response.policy())) {
                throw new IllegalStateException("Configured S3 bucket has an anonymous allow policy; refusing production startup.");
            }
        } catch (S3Exception exception) {
            // MinIO may represent a missing policy as a generic 404.
            if (exception.statusCode() != 404) {
                throw exception;
            }
        }
    }

    private boolean permitsAnonymousAccess(String policy) {
        try {
            JsonNode statements = objectMapper.readTree(policy).path("Statement");
            if (!statements.isArray()) return false;
            for (JsonNode statement : statements) {
                if ("Allow".equalsIgnoreCase(statement.path("Effect").asText())
                        && principalIsPublic(statement.path("Principal"))) {
                    return true;
                }
            }
            return false;
        } catch (Exception exception) {
            // A policy we cannot parse must not be trusted as private.
            throw new IllegalStateException("Unable to validate configured S3 bucket policy.", exception);
        }
    }

    private boolean principalIsPublic(JsonNode principal) {
        if (principal.isTextual()) return "*".equals(principal.asText());
        if (principal.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = principal.fields();
            while (fields.hasNext()) {
                if (principalIsPublic(fields.next().getValue())) return true;
            }
            return false;
        }
        if (principal.isArray()) {
            for (JsonNode value : principal) if (principalIsPublic(value)) return true;
        }
        return false;
    }
}
