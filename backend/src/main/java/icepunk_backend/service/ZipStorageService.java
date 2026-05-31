package icepunk_backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.file.Path;
import java.util.UUID;

@Service
public class ZipStorageService {

    private final S3Client s3Client;

    @Value("${s3.bucket}")
    private String bucket;

    @Value("${s3.public-url}")
    private String publicUrl;

    public ZipStorageService(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    public String uploadZip(Path zipPath) {
        String key = "zips/" + UUID.randomUUID() + ".zip";

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType("application/zip")
                .build();

        s3Client.putObject(request, RequestBody.fromFile(zipPath));

        return publicUrl + "/" + key;
    }
}