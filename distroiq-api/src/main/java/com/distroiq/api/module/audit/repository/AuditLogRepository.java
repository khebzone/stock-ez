package com.distroiq.api.module.audit.repository;

import com.distroiq.api.module.audit.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @Query("SELECT a FROM AuditLog a WHERE a.tenantId = :tenantId AND a.entityType = :entityType AND a.entityId = :entityId ORDER BY a.performedAt DESC")
    List<AuditLog> findByTenantAndEntity(
            @Param("tenantId") UUID tenantId,
            @Param("entityType") String entityType,
            @Param("entityId") UUID entityId);
}
