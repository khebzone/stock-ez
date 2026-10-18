package com.stockez.api.module.tracking.service;

import com.stockez.api.module.tenant.entity.TenantSettings;
import com.stockez.api.module.tenant.repository.TenantSettingsRepository;
import com.stockez.api.module.tracking.repository.StaffLocationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Trims the breadcrumb trail. Position pings are the highest-volume rows this app writes and they
 * lose value quickly — a month-old trail answers nothing the visit log does not. Visits themselves
 * are never purged: they carry business meaning and are tiny by comparison.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LocationRetentionService {

    private final StaffLocationRepository locationRepository;
    private final TenantSettingsRepository settingsRepository;

    @Scheduled(cron = "0 30 2 * * *")
    @Transactional
    public void purgeOldTrails() {
        for (TenantSettings settings : settingsRepository.findAll()) {
            int retention = settings.getLocationRetentionDays();
            if (retention <= 0 || settings.getTenant() == null) continue;

            Instant cutoff = Instant.now().minus(retention, ChronoUnit.DAYS);
            int deleted = locationRepository
                    .deleteOlderThanForTenant(settings.getTenant().getId(), cutoff);
            if (deleted > 0) {
                log.info("Purged {} location pings older than {} days for tenant {}",
                        deleted, retention, settings.getTenant().getId());
            }
        }
    }
}
