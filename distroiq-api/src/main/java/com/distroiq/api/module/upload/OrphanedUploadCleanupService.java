package com.distroiq.api.module.upload;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrphanedUploadCleanupService {

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    private final JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "0 0 2 * * *")
    public int cleanOrphanedUploads() {
        Path uploadPath = Paths.get(uploadDir);
        if (!Files.exists(uploadPath)) return 0;

        Set<String> referenced = new HashSet<>();
        collectFilenames("SELECT image_url        FROM products  WHERE image_url IS NOT NULL",        referenced);
        collectFilenames("SELECT owner_image_url   FROM customers WHERE owner_image_url IS NOT NULL",  referenced);
        collectFilenames("SELECT shop_image_url    FROM customers WHERE shop_image_url IS NOT NULL",   referenced);
        collectFilenames("SELECT profile_image_url FROM users     WHERE profile_image_url IS NOT NULL", referenced);
        collectFilenames("SELECT logo_url          FROM tenants   WHERE logo_url IS NOT NULL",          referenced);

        int deleted = 0;
        try (var stream = Files.list(uploadPath)) {
            for (Path file : stream.filter(Files::isRegularFile).toList()) {
                if (!referenced.contains(file.getFileName().toString())) {
                    try {
                        Files.delete(file);
                        deleted++;
                    } catch (IOException e) {
                        log.warn("Could not delete orphaned upload: {}", file.getFileName());
                    }
                }
            }
        } catch (IOException e) {
            log.error("Error scanning uploads directory", e);
        }

        if (deleted > 0) log.info("Deleted {} orphaned upload file(s)", deleted);
        return deleted;
    }

    private void collectFilenames(String sql, Set<String> filenames) {
        jdbcTemplate.queryForList(sql, String.class).forEach(url -> {
            if (url != null && url.contains("/uploads/")) {
                filenames.add(url.substring(url.lastIndexOf("/uploads/") + 9));
            }
        });
    }
}
