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
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.UUID;

@Service
public class UserUploadStorageService {

    private static final Logger log = LoggerFactory.getLogger(UserUploadStorageService.class);
    private static final String USER_UPLOAD_PREFIX = "user_uploads/";
    private static final String AVATAR_PREFIX = "avatars/";

    private final S3Client s3Client;

    @Value("${s3.bucket}")
    private String bucket;

    public UserUploadStorageService(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    public StoredUpload upload(
            Long ownerId,
            String originalFilename,
            String contentType,
            long size,
            InputStream inputStream
    ) throws IOException {
        String key = USER_UPLOAD_PREFIX + ownerId + "/" + UUID.randomUUID() + extensionFrom(originalFilename);

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .contentLength(size)
                .build();

        try {
            s3Client.putObject(request, RequestBody.fromInputStream(inputStream, size));
        } catch (ApiCallTimeoutException | ApiCallAttemptTimeoutException exception) {
            log.warn("S3 user upload timed out for bucket={} key={}: {}", bucket, key, exception.getMessage());
            throw new StorageTimeoutException("File upload timed out. Please try again.");
        } catch (SdkException exception) {
            log.error("S3 user upload failed for bucket={} key={}: {}", bucket, key, exception.getMessage());
            throw new StorageException("File upload failed. Please try again.");
        }

        return new StoredUpload(key);
    }

    public StoredUpload uploadAvatar(
            Long ownerId,
            String originalFilename,
            String contentType,
            byte[] bytes
    ) throws IOException {
        String key = AVATAR_PREFIX + ownerId + "/" + UUID.randomUUID() + extensionFrom(originalFilename);

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(contentType)
                    .contentLength((long) bytes.length)
                    .build();

            s3Client.putObject(request, RequestBody.fromBytes(bytes));
            return new StoredUpload(key);
        } catch (Exception exception) {
            log.warn("S3 avatar upload failed, falling back to local disk storage for key={}: {}", key, exception.getMessage());
            return storeLocally(key, bytes);
        }
    }

    private StoredUpload storeLocally(String key, byte[] bytes) {
        try {
            java.nio.file.Path targetPath = java.nio.file.Paths.get(System.getProperty("user.dir"), "user_uploads", key);
            java.nio.file.Files.createDirectories(targetPath.getParent());
            java.nio.file.Files.write(targetPath, bytes);

            String localPublicUrl = "http://localhost:8081/user-uploads/" + key;
            log.info("Stored upload locally for key={}, publicUrl={}", key, localPublicUrl);
            return new StoredUpload(localPublicUrl);
        } catch (IOException e) {
            log.error("Failed to store upload locally for key={}: {}", key, e.getMessage());
            throw new StorageException("Avatar upload failed. Please try again.");
        }
    }

    public byte[] readObjectBytes(String objectKey) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .build();

        try {
            ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(request);
            return response.asByteArray();
        } catch (ApiCallTimeoutException | ApiCallAttemptTimeoutException exception) {
            log.warn("S3 user object read timed out for bucket={} key={}: {}", bucket, objectKey, exception.getMessage());
            throw new StorageTimeoutException("File download timed out. Please try again.");
        } catch (SdkException exception) {
            log.error("S3 user object read failed for bucket={} key={}: {}", bucket, objectKey, exception.getMessage());
            throw new StorageException("File download failed. Please try again.");
        }
    }

    private String extensionFrom(String filename) {
        if (filename == null) {
            return "";
        }

        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return "";
        }

        return filename.substring(dot).toLowerCase(Locale.ROOT);
    }

    public record StoredUpload(String objectKey) {
    }
}
