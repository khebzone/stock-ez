package com.stockez.api.module.audit.repository;

import com.stockez.api.module.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @Query("SELECT a FROM AuditLog a WHERE a.tenantId = :tenantId AND a.entityType = :entityType AND a.entityId = :entityId ORDER BY a.performedAt DESC")
    List<AuditLog> findByTenantAndEntity(
            @Param("tenantId") UUID tenantId,
            @Param("entityType") String entityType,
            @Param("entityId") UUID entityId);

    @Query("SELECT a FROM AuditLog a WHERE a.tenantId = :tenantId " +
           "AND (:entityType IS NULL OR a.entityType = :entityType) " +
           "AND (:performedBy IS NULL OR LOWER(a.performedBy) LIKE LOWER(CONCAT('%', :performedBy, '%'))) " +
           "AND (:action IS NULL OR a.action = :action) " +
           "AND (:from IS NULL OR a.performedAt >= :from) " +
           "AND (:to IS NULL OR a.performedAt < :to) " +
           "ORDER BY a.performedAt DESC")
    Page<AuditLog> findFiltered(
            @Param("tenantId") UUID tenantId,
            @Param("entityType") String entityType,
            @Param("performedBy") String performedBy,
            @Param("action") String action,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);
}
