package icepunk_backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetBucketPolicyResponse;
import software.amazon.awssdk.services.s3.model.GetBucketPolicyRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketResponse;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class S3BucketInitializerTest {

    @Test
    void productionStartupRejectsAnonymousAllowBucketPolicy() {
        S3Client client = mock(S3Client.class);
        when(client.headBucket(any(HeadBucketRequest.class))).thenReturn(HeadBucketResponse.builder().build());
        when(client.getBucketPolicy(any(GetBucketPolicyRequest.class))).thenReturn(GetBucketPolicyResponse.builder()
                .policy("""
                        {"Version":"2012-10-17","Statement":[{
                        "Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"*"}]}
                        """)
                .build());

        S3BucketInitializer initializer = new S3BucketInitializer(client, "icepunk-zips",
                productionEnvironment(), new ObjectMapper());

        assertThrows(IllegalStateException.class, initializer::ensureBucketExists);
    }

    @Test
    void productionStartupAcceptsPolicyLimitedToApplicationPrincipal() {
        S3Client client = mock(S3Client.class);
        when(client.headBucket(any(HeadBucketRequest.class))).thenReturn(HeadBucketResponse.builder().build());
        when(client.getBucketPolicy(any(GetBucketPolicyRequest.class))).thenReturn(GetBucketPolicyResponse.builder()
                .policy("""
                        {"Version":"2012-10-17","Statement":[{
                        "Effect":"Allow","Principal":{"AWS":"icepunk-app"},"Action":"s3:GetObject","Resource":"*"}]}
                        """)
                .build());

        S3BucketInitializer initializer = new S3BucketInitializer(client, "icepunk-zips",
                productionEnvironment(), new ObjectMapper());

        assertDoesNotThrow(initializer::ensureBucketExists);
    }

    private MockEnvironment productionEnvironment() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        return environment;
    }
}
