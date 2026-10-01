package com.stockez.api.module.purchase.repository;

import com.stockez.api.module.purchase.entity.StockBatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StockBatchRepository extends JpaRepository<StockBatch, UUID> {

    @Query("SELECT b FROM StockBatch b WHERE b.tenant.id = :tenantId AND b.product.id = :productId AND b.active = true AND b.quantityAvailable > 0 ORDER BY b.receivedDate ASC, b.createdAt ASC")
    List<StockBatch> findFifoByProduct(@Param("tenantId") UUID tenantId, @Param("productId") UUID productId);

    @Query("SELECT b FROM StockBatch b WHERE b.tenant.id = :tenantId AND b.product.id IN :productIds AND b.active = true AND b.quantityAvailable > 0 ORDER BY b.product.id, b.receivedDate ASC, b.createdAt ASC")
    List<StockBatch> findFifoByProducts(@Param("tenantId") UUID tenantId, @Param("productIds") List<UUID> productIds);

    @Query("SELECT b FROM StockBatch b WHERE b.tenant.id = :tenantId AND b.product.id = :productId ORDER BY b.receivedDate DESC")
    List<StockBatch> findByTenantAndProduct(@Param("tenantId") UUID tenantId, @Param("productId") UUID productId);

    @Query("SELECT COALESCE(SUM(b.quantityAvailable), 0) FROM StockBatch b WHERE b.tenant.id = :tenantId AND b.product.id = :productId AND b.active = true")
    Integer sumAvailableByProduct(@Param("tenantId") UUID tenantId, @Param("productId") UUID productId);

    @Query("SELECT b FROM StockBatch b WHERE b.tenant.id = :tenantId AND b.active = true AND b.quantityAvailable > 0 AND b.expiryDate IS NOT NULL AND b.expiryDate <= :alertDate ORDER BY b.expiryDate ASC")
    List<StockBatch> findNearExpiry(@Param("tenantId") UUID tenantId, @Param("alertDate") LocalDate alertDate);

    @Query("SELECT b FROM StockBatch b WHERE b.tenant.id = :tenantId ORDER BY b.createdAt DESC")
    List<StockBatch> findAllByTenant(@Param("tenantId") UUID tenantId);

    @Query("SELECT b FROM StockBatch b LEFT JOIN b.product p LEFT JOIN p.brandMaster bm WHERE b.tenant.id = :tenantId AND b.active = true " +
           "AND (:brand IS NULL OR LOWER(bm.name) = :brand) " +
           "AND (:search IS NULL OR LOWER(p.name) LIKE :search) " +
           "ORDER BY b.createdAt DESC")
    Page<StockBatch> findActiveFiltered(@Param("tenantId") UUID tenantId, @Param("brand") String brand, @Param("search") String search, Pageable pageable);

    @Query("SELECT b FROM StockBatch b LEFT JOIN b.product p LEFT JOIN p.brandMaster bm WHERE b.tenant.id = :tenantId AND b.active = true " +
           "AND b.expiryDate IS NOT NULL AND b.expiryDate < CURRENT_DATE " +
           "AND (:brand IS NULL OR LOWER(bm.name) = :brand) " +
           "AND (:search IS NULL OR LOWER(p.name) LIKE :search) " +
           "ORDER BY b.expiryDate ASC")
    Page<StockBatch> findExpiredFiltered(@Param("tenantId") UUID tenantId, @Param("brand") String brand, @Param("search") String search, Pageable pageable);

    @Query("SELECT b FROM StockBatch b LEFT JOIN b.product p LEFT JOIN p.brandMaster bm WHERE b.tenant.id = :tenantId AND b.active = true " +
           "AND b.expiryDate IS NOT NULL AND b.expiryDate >= CURRENT_DATE AND b.expiryDate <= :alertDate " +
           "AND (:brand IS NULL OR LOWER(bm.name) = :brand) " +
           "AND (:search IS NULL OR LOWER(p.name) LIKE :search) " +
           "ORDER BY b.expiryDate ASC")
    Page<StockBatch> findNearExpiryFiltered(@Param("tenantId") UUID tenantId, @Param("alertDate") LocalDate alertDate, @Param("brand") String brand, @Param("search") String search, Pageable pageable);

    @Query("SELECT b.product.id, MIN(b.receivedDate) FROM StockBatch b WHERE b.tenant.id = :tenantId GROUP BY b.product.id")
    List<Object[]> findFirstReceivedDatePerProduct(@Param("tenantId") UUID tenantId);

    @Query("SELECT COUNT(b) FROM StockBatch b WHERE b.tenant.id = :tenantId AND b.receivedDate = :date")
    int countByTenantAndDate(@Param("tenantId") UUID tenantId, @Param("date") java.time.LocalDate date);

    @Query("SELECT b FROM StockBatch b WHERE b.tenant.id = :tenantId AND b.product.id = :productId AND b.expiryDate = :expiryDate AND b.purchaseRate = :purchaseRate AND b.mrp = :mrp AND b.active = true")
    Optional<StockBatch> findMergeableBatch(@Param("tenantId") UUID tenantId, @Param("productId") UUID productId, @Param("expiryDate") LocalDate expiryDate, @Param("purchaseRate") BigDecimal purchaseRate, @Param("mrp") BigDecimal mrp);

    @Query("SELECT b FROM StockBatch b WHERE b.tenant.id = :tenantId AND b.batchNumber = :batchNumber")
    Optional<StockBatch> findByTenantAndBatchNumber(@Param("tenantId") UUID tenantId, @Param("batchNumber") String batchNumber);

    @Query("SELECT b FROM StockBatch b JOIN FETCH b.product WHERE b.tenant.id = :tenantId AND b.batchNumber IN :batchNumbers")
    List<StockBatch> findByTenantAndBatchNumbers(@Param("tenantId") UUID tenantId, @Param("batchNumbers") java.util.Collection<String> batchNumbers);

    @Query("SELECT COUNT(b) FROM StockBatch b WHERE b.tenant.id = :tenantId AND b.active = true AND b.quantityAvailable > 0 AND b.expiryDate IS NOT NULL AND b.expiryDate <= :alertDate")
    long countNearExpiryBatches(@Param("tenantId") UUID tenantId, @Param("alertDate") java.time.LocalDate alertDate);
}
