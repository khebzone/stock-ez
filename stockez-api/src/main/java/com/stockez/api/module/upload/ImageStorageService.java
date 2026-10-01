package com.stockez.api.module.upload;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@Slf4j
public class ImageStorageService {

    @Value("${app.storage.r2.account-id:}")
    private String r2AccountId;

    @Value("${app.storage.r2.access-key:}")
    private String r2AccessKey;

    @Value("${app.storage.r2.secret-key:}")
    private String r2SecretKey;

    @Value("${app.storage.r2.bucket:stockez-images}")
    private String r2Bucket;

    @Value("${app.storage.r2.public-url:}")
    private String r2PublicUrl;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @Value("${app.upload.base-url:http://localhost:8080}")
    private String baseUrl;

    private S3Client s3Client;

    @PostConstruct
    void init() {
        if (isR2Configured()) {
            s3Client = S3Client.builder()
                    .endpointOverride(URI.create("https://" + r2AccountId + ".r2.cloudflarestorage.com"))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(r2AccessKey, r2SecretKey)))
                    .region(Region.of("auto"))
                    .build();
            log.info("R2 storage configured — bucket: {}", r2Bucket);
        } else {
            log.info("R2 not configured — using local file storage");
        }
    }

    public String store(byte[] imageBytes, String filename) throws IOException {
        if (isR2Configured()) {
            return uploadToR2(imageBytes, filename);
        }
        return saveLocally(imageBytes, filename);
    }

    private boolean isR2Configured() {
        return r2AccountId != null && !r2AccountId.isBlank()
                && r2AccessKey != null && !r2AccessKey.isBlank()
                && r2SecretKey != null && !r2SecretKey.isBlank()
                && r2PublicUrl != null && !r2PublicUrl.isBlank();
    }

    private String uploadToR2(byte[] imageBytes, String filename) {
        PutObjectRequest req = PutObjectRequest.builder()
                .bucket(r2Bucket)
                .key("products/" + filename)
                .contentType("image/jpeg")
                .contentLength((long) imageBytes.length)
                .cacheControl("public, max-age=31536000, immutable")
                .build();
        s3Client.putObject(req, RequestBody.fromBytes(imageBytes));
        return r2PublicUrl + "/products/" + filename;
    }

    private String saveLocally(byte[] imageBytes, String filename) throws IOException {
        Path dir = Paths.get(uploadDir);
        if (!Files.exists(dir)) Files.createDirectories(dir);
        Files.write(dir.resolve(filename), imageBytes);
        return baseUrl + "/uploads/" + filename;
    }

    public List<String> listAllKeys() {
        if (isR2Configured()) {
            List<String> keys = new ArrayList<>();
            String token = null;
            do {
                ListObjectsV2Request.Builder builder = ListObjectsV2Request.builder()
                        .bucket(r2Bucket).prefix("products/");
                if (token != null) builder.continuationToken(token);
                ListObjectsV2Response resp = s3Client.listObjectsV2(builder.build());
                resp.contents().forEach(obj -> keys.add(obj.key()));
                token = resp.isTruncated() ? resp.nextContinuationToken() : null;
            } while (token != null);
            return keys;
        }
        try {
            Path dir = Paths.get(uploadDir);
            if (!Files.exists(dir)) return List.of();
            return Files.list(dir)
                    .filter(Files::isRegularFile)
                    .map(p -> p.getFileName().toString())
                    .toList();
        } catch (IOException e) {
            log.error("Error listing local uploads", e);
            return List.of();
        }
    }

    public void delete(String key) {
        if (isR2Configured()) {
            s3Client.deleteObject(DeleteObjectRequest.builder().bucket(r2Bucket).key(key).build());
            log.debug("Deleted R2 object: {}", key);
        } else {
            try {
                Files.deleteIfExists(Paths.get(uploadDir).resolve(key));
            } catch (IOException e) {
                log.warn("Could not delete local file: {}", key);
            }
        }
    }

    public void deleteByUrls(List<String> urls) {
        urls.stream()
                .map(this::extractKeyFromUrl)
                .filter(Objects::nonNull)
                .forEach(this::delete);
    }

    public String extractKeyFromUrl(String url) {
        if (url == null) return null;
        if (isR2Configured()) {
            if (url.startsWith(r2PublicUrl)) {
                return url.substring(r2PublicUrl.length()).replaceFirst("^/", "");
            }
        } else {
            int idx = url.indexOf("/uploads/");
            if (idx >= 0) return url.substring(idx + 9);
        }
        return null;
    }
}
