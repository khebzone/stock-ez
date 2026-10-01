package com.stockez.api.module.purchase.repository;

import com.stockez.api.module.purchase.entity.PurchaseEntry;
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

    @Query("SELECT p FROM PurchaseEntry p WHERE p.tenant.id = :tenantId AND p.openingBalance = false ORDER BY p.purchaseDate DESC, p.createdAt DESC")
    Page<PurchaseEntry> findByTenantIdOrderByPurchaseDateDescCreatedAtDesc(@Param("tenantId") UUID tenantId, Pageable pageable);

    @Query("SELECT p FROM PurchaseEntry p WHERE p.tenant.id = :tenantId " +
           "AND p.openingBalance = false " +
           "AND (:supplierName IS NULL OR LOWER(p.supplierName) LIKE :supplierName) " +
           "AND (:invoiceNumber IS NULL OR LOWER(p.invoiceNumber) LIKE :invoiceNumber) " +
           "AND p.purchaseDate >= :from " +
           "AND p.purchaseDate <= :to " +
           "ORDER BY p.purchaseDate DESC, p.createdAt DESC")
    Page<PurchaseEntry> findFiltered(
            @Param("tenantId") UUID tenantId,
            @Param("supplierName") String supplierName,
            @Param("invoiceNumber") String invoiceNumber,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            Pageable pageable);

    Optional<PurchaseEntry> findByIdAndTenantId(UUID id, UUID tenantId);

    // How many purchase-line items feed the same batch — >1 means the batch was merged (shared).
    @Query("SELECT COUNT(i) FROM PurchaseItem i WHERE i.purchaseEntry.tenant.id = :tenantId AND i.batchNumber = :batchNumber")
    long countItemsSharingBatch(@Param("tenantId") UUID tenantId, @Param("batchNumber") String batchNumber);

    @Query("SELECT p FROM PurchaseEntry p WHERE p.tenant.id = :tenantId AND p.openingBalance = false ORDER BY p.purchaseDate DESC, p.createdAt DESC")
    java.util.List<PurchaseEntry> findAllByTenant(@Param("tenantId") UUID tenantId);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(p.entryNumber, 10) AS int)), 0) FROM PurchaseEntry p WHERE p.tenant.id = :tenantId")
    int findMaxEntrySequence(@Param("tenantId") UUID tenantId);

    @Query("SELECT p FROM PurchaseEntry p WHERE p.tenant.id = :tenantId AND p.openingBalance = false AND p.purchaseDate BETWEEN :from AND :to ORDER BY p.purchaseDate ASC")
    java.util.List<PurchaseEntry> findByTenantAndDateRange(@Param("tenantId") UUID tenantId, @Param("from") java.time.LocalDate from, @Param("to") java.time.LocalDate to);

    @Query("SELECT p.supplierName, COALESCE(SUM(p.totalAmount), 0), MAX(p.purchaseDate) " +
           "FROM PurchaseEntry p WHERE p.tenant.id = :tenantId GROUP BY p.supplierName ORDER BY SUM(p.totalAmount) DESC")
    java.util.List<Object[]> sumBySupplierName(@Param("tenantId") UUID tenantId);

    java.util.List<PurchaseEntry> findByTenantIdAndSupplierNameOrderByPurchaseDateDesc(UUID tenantId, String supplierName);

    @Query("SELECT COALESCE(SUM(p.totalAmount), 0) FROM PurchaseEntry p WHERE p.tenant.id = :tenantId")
    java.math.BigDecimal sumTotalPurchasedByTenant(@Param("tenantId") UUID tenantId);

    @Query("SELECT p FROM PurchaseEntry p WHERE p.tenant.id = :tenantId " +
           "AND LOWER(p.supplierName) = LOWER(:supplierName) " +
           "AND p.paidAmount < p.totalAmount " +
           "ORDER BY p.purchaseDate ASC, p.createdAt ASC")
    java.util.List<PurchaseEntry> findUnpaidBySupplierName(@Param("tenantId") UUID tenantId, @Param("supplierName") String supplierName);

    @Query("SELECT DISTINCT p FROM PurchaseEntry p JOIN FETCH p.items i JOIN FETCH i.product LEFT JOIN FETCH p.supplier WHERE p.tenant.id = :tenantId AND p.openingBalance = false AND p.purchaseDate BETWEEN :from AND :to ORDER BY p.purchaseDate ASC, p.entryNumber ASC")
    java.util.List<PurchaseEntry> findWithItemsByTenantAndDateRange(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT p FROM PurchaseEntry p WHERE p.tenant.id = :tenantId " +
           "AND LOWER(p.supplierName) = LOWER(:supplierName) " +
           "AND p.purchaseDate BETWEEN :from AND :to ORDER BY p.purchaseDate ASC, p.createdAt ASC")
    java.util.List<PurchaseEntry> findByTenantAndSupplierAndDateRange(
            @Param("tenantId") UUID tenantId, @Param("supplierName") String supplierName,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT COALESCE(SUM(p.totalAmount), 0) FROM PurchaseEntry p WHERE p.tenant.id = :tenantId " +
           "AND LOWER(p.supplierName) = LOWER(:supplierName) AND p.purchaseDate < :from")
    java.math.BigDecimal sumPurchasedBySupplierBeforeDate(
            @Param("tenantId") UUID tenantId, @Param("supplierName") String supplierName, @Param("from") LocalDate from);
}
