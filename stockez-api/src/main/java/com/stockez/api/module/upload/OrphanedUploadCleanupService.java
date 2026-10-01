package com.stockez.api.module.upload;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrphanedUploadCleanupService {

    private final JdbcTemplate jdbcTemplate;
    private final ImageStorageService imageStorageService;

    // Kill switch — set ORPHAN_CLEANUP_ENABLED=false to turn off the auto-delete
    // (e.g. while rebuilding/importing data, when old images look "orphaned").
    @org.springframework.beans.factory.annotation.Value("${ORPHAN_CLEANUP_ENABLED:true}")
    private boolean cleanupEnabled;

    @Scheduled(cron = "0 0 2 * * *")
    public int cleanOrphanedUploads() {
        if (!cleanupEnabled) {
            log.info("Orphan upload cleanup is DISABLED (ORPHAN_CLEANUP_ENABLED=false) — skipping.");
            return 0;
        }
        Set<String> referencedUrls = new HashSet<>();
        collectUrls("SELECT image_url        FROM products  WHERE image_url IS NOT NULL",        referencedUrls);
        collectUrls("SELECT owner_image_url   FROM customers WHERE owner_image_url IS NOT NULL",  referencedUrls);
        collectUrls("SELECT shop_image_url    FROM customers WHERE shop_image_url IS NOT NULL",   referencedUrls);
        collectUrls("SELECT profile_image_url FROM users     WHERE profile_image_url IS NOT NULL", referencedUrls);
        collectUrls("SELECT logo_url          FROM tenants   WHERE logo_url IS NOT NULL",          referencedUrls);

        Set<String> referencedKeys = referencedUrls.stream()
                .map(imageStorageService::extractKeyFromUrl)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<String> allKeys = imageStorageService.listAllKeys();

        // Safety guard: if nothing is referenced but images exist, the DB is likely empty
        // (fresh deploy / migration). Deleting everything here would wipe all uploads, so bail out.
        if (referencedKeys.isEmpty() && !allKeys.isEmpty()) {
            log.warn("Orphan cleanup skipped: 0 referenced images but {} exist in storage — "
                    + "refusing to delete all (DB likely empty/restoring).", allKeys.size());
            return 0;
        }

        int deleted = 0;
        for (String key : allKeys) {
            if (!referencedKeys.contains(key)) {
                imageStorageService.delete(key);
                deleted++;
            }
        }

        if (deleted > 0) log.info("Deleted {} orphaned upload file(s)", deleted);
        return deleted;
    }

    public void deleteTenantImages(UUID tenantId) {
        List<String> urls = new ArrayList<>();
        urls.addAll(jdbcTemplate.queryForList("SELECT image_url        FROM products  WHERE tenant_id = ? AND image_url IS NOT NULL",        String.class, tenantId));
        urls.addAll(jdbcTemplate.queryForList("SELECT owner_image_url   FROM customers WHERE tenant_id = ? AND owner_image_url IS NOT NULL",  String.class, tenantId));
        urls.addAll(jdbcTemplate.queryForList("SELECT shop_image_url    FROM customers WHERE tenant_id = ? AND shop_image_url IS NOT NULL",   String.class, tenantId));
        urls.addAll(jdbcTemplate.queryForList("SELECT profile_image_url FROM users     WHERE tenant_id = ? AND profile_image_url IS NOT NULL", String.class, tenantId));
        urls.addAll(jdbcTemplate.queryForList("SELECT logo_url          FROM tenants   WHERE id = ?        AND logo_url IS NOT NULL",          String.class, tenantId));
        imageStorageService.deleteByUrls(urls);
        log.info("Deleted {} image(s) for inactive tenant {}", urls.size(), tenantId);
    }

    private void collectUrls(String sql, Set<String> urls) {
        jdbcTemplate.queryForList(sql, String.class).stream()
                .filter(url -> url != null && !url.isBlank())
                .forEach(urls::add);
    }
}
