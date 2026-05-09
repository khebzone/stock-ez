package com.distroiq.api.module.purchase.repository;

import com.distroiq.api.module.purchase.entity.PurchaseEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PurchaseEntryRepository extends JpaRepository<PurchaseEntry, UUID> {

    Page<PurchaseEntry> findByTenantIdOrderByPurchaseDateDescCreatedAtDesc(UUID tenantId, Pageable pageable);

    @Query("SELECT p FROM PurchaseEntry p WHERE p.tenant.id = :tenantId " +
           "AND (:supplierName IS NULL OR LOWER(p.supplierName) LIKE :supplierName) " +
           "AND (:from IS NULL OR p.purchaseDate >= :from) " +
           "AND (:to IS NULL OR p.purchaseDate <= :to) " +
           "ORDER BY p.purchaseDate DESC, p.createdAt DESC")
    Page<PurchaseEntry> findFiltered(
            @Param("tenantId") UUID tenantId,
            @Param("supplierName") String supplierName,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            Pageable pageable);

    Optional<PurchaseEntry> findByIdAndTenantId(UUID id, UUID tenantId);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(p.entryNumber, 10) AS int)), 0) FROM PurchaseEntry p WHERE p.tenant.id = :tenantId")
    int findMaxEntrySequence(@Param("tenantId") UUID tenantId);

    @Query("SELECT p FROM PurchaseEntry p WHERE p.tenant.id = :tenantId AND p.purchaseDate BETWEEN :from AND :to ORDER BY p.purchaseDate ASC")
    java.util.List<PurchaseEntry> findByTenantAndDateRange(@Param("tenantId") UUID tenantId, @Param("from") java.time.LocalDate from, @Param("to") java.time.LocalDate to);

    @Query("SELECT p.supplierName, COALESCE(SUM(p.totalAmount), 0), MAX(p.purchaseDate) " +
           "FROM PurchaseEntry p WHERE p.tenant.id = :tenantId GROUP BY p.supplierName ORDER BY SUM(p.totalAmount) DESC")
    java.util.List<Object[]> sumBySupplierName(@Param("tenantId") UUID tenantId);

    java.util.List<PurchaseEntry> findByTenantIdAndSupplierNameOrderByPurchaseDateDesc(UUID tenantId, String supplierName);
}
