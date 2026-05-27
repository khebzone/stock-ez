package com.stockez.api.module.attendance.repository;

import com.stockez.api.module.attendance.entity.AttendanceSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AttendanceSettingsRepository extends JpaRepository<AttendanceSettings, UUID> {
    Optional<AttendanceSettings> findByTenantId(UUID tenantId);
}
