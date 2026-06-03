package com.stockez.api.module.tenant.repository;

import com.stockez.api.module.tenant.entity.TenantSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TenantSettingsRepository extends JpaRepository<TenantSettings, UUID> {
    Optional<TenantSettings> findByTenantId(UUID tenantId);
}
