package com.stockez.api.module.tracking.service;

import com.stockez.api.module.tenant.entity.TenantSettings;
import com.stockez.api.module.tenant.repository.TenantSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * The entry point every billing path uses. Swallows its own failures on purpose: a salesman must
 * never be unable to raise a bill because location recording broke.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VisitStampService {

    private final VisitWriter writer;
    private final TenantSettingsRepository settingsRepository;

    public void stampQuietly(VisitStamp stamp) {
        if (stamp == null || stamp.getTenantId() == null
                || stamp.getUserId() == null || stamp.getCustomerId() == null) {
            return;
        }
        try {
            boolean enabled = settingsRepository.findByTenantId(stamp.getTenantId())
                    .map(TenantSettings::isLocationTrackingEnabled)
                    .orElse(false);
            if (!enabled) return;
            writer.write(stamp);
        } catch (Exception e) {
            log.warn("Visit stamp failed (tenant={}, customer={}, outcome={}): {}",
                    stamp.getTenantId(), stamp.getCustomerId(), stamp.getOutcome(), e.toString());
        }
    }
}
