package com.stockez.api.module.goodsreturn.repository;

import com.stockez.api.module.goodsreturn.entity.GoodsReturn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GoodsReturnRepository extends JpaRepository<GoodsReturn, UUID> {

    Page<GoodsReturn> findByTenantIdOrderByReturnDateDescCreatedAtDesc(UUID tenantId, Pageable pageable);

    Optional<GoodsReturn> findByIdAndTenantId(UUID id, UUID tenantId);

    List<GoodsReturn> findByTenantIdAndRefundStatusAndTypeOrderByReturnDateDesc(UUID tenantId, GoodsReturn.RefundStatus refundStatus, GoodsReturn.ReturnType type);

    List<GoodsReturn> findByTenantIdAndRefundStatusAndTypeInOrderByReturnDateDesc(
            UUID tenantId, GoodsReturn.RefundStatus refundStatus, java.util.Collection<GoodsReturn.ReturnType> types);

    List<GoodsReturn> findByTenantIdAndRefundStatusOrderByReturnDateDesc(UUID tenantId, GoodsReturn.RefundStatus refundStatus);

    List<GoodsReturn> findByTenantIdAndTypeAndRefundStatusInOrderByReturnDateDesc(
            UUID tenantId, GoodsReturn.ReturnType type, java.util.Collection<GoodsReturn.RefundStatus> refundStatuses);

    // Money owed to us by suppliers: purchase returns + supplier-caused damage.
    @Query("SELECT g FROM GoodsReturn g WHERE g.tenant.id = :tenantId AND g.refundStatus IN :statuses " +
           "AND (g.type = :purchaseType OR (g.type = :damageType AND g.damageSource = 'SUPPLIER')) " +
           "ORDER BY g.returnDate DESC")
    List<GoodsReturn> findSupplierClaims(@Param("tenantId") UUID tenantId,
            @Param("statuses") java.util.Collection<GoodsReturn.RefundStatus> statuses,
            @Param("purchaseType") GoodsReturn.ReturnType purchaseType,
            @Param("damageType") GoodsReturn.ReturnType damageType);

    List<GoodsReturn> findByTenantIdAndReferenceOrderIdAndTypeOrderByReturnDateDescCreatedAtDesc(
            UUID tenantId, UUID orderId, GoodsReturn.ReturnType type);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(g.returnNumber, 10) AS int)), 0) FROM GoodsReturn g " +
           "WHERE g.tenant.id = :tenantId AND g.returnNumber LIKE CONCAT(:prefix, '-', :year, '-%')")
    int findMaxReturnSequence(@Param("tenantId") UUID tenantId, @Param("prefix") String prefix, @Param("year") int year);

    @Query("SELECT i.product.id, SUM(i.quantity) FROM GoodsReturn gr JOIN gr.items i " +
           "WHERE gr.tenant.id = :tenantId AND gr.referenceOrder.id = :orderId AND gr.type = :type " +
           "AND gr.warehouseStatus <> 'CANCELLED' " +
           "GROUP BY i.product.id")
    List<Object[]> sumReturnedQtyByOrder(@Param("tenantId") UUID tenantId, @Param("orderId") UUID orderId, @Param("type") GoodsReturn.ReturnType type);

    @Query("SELECT COUNT(g) FROM GoodsReturn g WHERE g.tenant.id = :tenantId AND g.warehouseStatus = 'PENDING_VERIFICATION'")
    long countPendingWarehouseVerification(@Param("tenantId") UUID tenantId);

    List<GoodsReturn> findByTenantIdAndWarehouseStatusOrderByReturnDateDescCreatedAtDesc(
            UUID tenantId, GoodsReturn.WarehouseStatus warehouseStatus);

    long countByTenantIdAndCreatedByIdAndWarehouseStatus(
            UUID tenantId, UUID createdById, GoodsReturn.WarehouseStatus warehouseStatus);

    List<GoodsReturn> findByTenantIdAndCreatedByIdAndReturnDateOrderByCreatedAtDesc(
            UUID tenantId, UUID createdById, LocalDate returnDate);

    @Query("SELECT COUNT(g) FROM GoodsReturn g WHERE g.tenant.id = :tenantId AND g.refundStatus = 'PENDING' AND g.type = 'PURCHASE_RETURN'")
    long countPendingSupplierClaims(@Param("tenantId") UUID tenantId);

    // ── Open supplier credit ───────────────────────────────────────────────────
    // Value the supplier still owes us that reduces our payable to them:
    //   · a purchase return not yet settled — we physically sent goods back and hold the credit
    //   · any claim settled as ADJUST_AGAINST_BILL — knocked off permanently
    // CASH_REFUND and GOODS_REPLACED hand the value back instead, so the bill stands in full.
    // A pending supplier-DAMAGE claim is excluded: nothing has gone back to them, it is only
    // a claim we have raised and they have not yet accepted.
    String OPEN_CREDIT_PREDICATE =
            "g.warehouseStatus <> 'CANCELLED' AND ("
          + "  (g.type = 'PURCHASE_RETURN' AND (g.settlementMode IS NULL OR g.settlementMode = 'ADJUST_AGAINST_BILL'))"
          + "  OR (g.type = 'DAMAGE' AND g.damageSource = 'SUPPLIER' AND g.settlementMode = 'ADJUST_AGAINST_BILL')"
          + ")";

    @Query("SELECT g.supplierName, COALESCE(SUM(g.totalAmount), 0) FROM GoodsReturn g "
         + "WHERE g.tenant.id = :tenantId AND g.supplierName IS NOT NULL AND " + OPEN_CREDIT_PREDICATE
         + " GROUP BY g.supplierName")
    List<Object[]> sumOpenSupplierCreditGrouped(@Param("tenantId") UUID tenantId);

    @Query("SELECT COALESCE(SUM(g.totalAmount), 0) FROM GoodsReturn g "
         + "WHERE g.tenant.id = :tenantId AND LOWER(g.supplierName) = LOWER(:supplierName) AND " + OPEN_CREDIT_PREDICATE)
    java.math.BigDecimal sumOpenSupplierCredit(
            @Param("tenantId") UUID tenantId, @Param("supplierName") String supplierName);

    @Query("SELECT COALESCE(SUM(g.totalAmount), 0) FROM GoodsReturn g "
         + "WHERE g.tenant.id = :tenantId AND LOWER(g.supplierName) = LOWER(:supplierName) "
         + "AND g.returnDate < :from AND " + OPEN_CREDIT_PREDICATE)
    java.math.BigDecimal sumOpenSupplierCreditBeforeDate(
            @Param("tenantId") UUID tenantId, @Param("supplierName") String supplierName,
            @Param("from") LocalDate from);

    // Per-bill credit — only returns filed against a specific purchase entry can offset that bill.
    @Query("SELECT g.referencePurchaseEntry.id, COALESCE(SUM(g.totalAmount), 0) FROM GoodsReturn g "
         + "WHERE g.tenant.id = :tenantId AND g.referencePurchaseEntry IS NOT NULL AND " + OPEN_CREDIT_PREDICATE
         + " GROUP BY g.referencePurchaseEntry.id")
    List<Object[]> sumOpenCreditByPurchaseEntryGrouped(@Param("tenantId") UUID tenantId);

    @Query("SELECT COALESCE(SUM(g.totalAmount), 0) FROM GoodsReturn g "
         + "WHERE g.tenant.id = :tenantId AND g.referencePurchaseEntry.id = :purchaseEntryId AND " + OPEN_CREDIT_PREDICATE)
    java.math.BigDecimal sumOpenCreditByPurchaseEntry(
            @Param("tenantId") UUID tenantId, @Param("purchaseEntryId") UUID purchaseEntryId);

    // Every supplier claim in a period — drives the return rows on the Supplier History statement.
    @Query("SELECT g FROM GoodsReturn g WHERE g.tenant.id = :tenantId "
         + "AND LOWER(g.supplierName) = LOWER(:supplierName) AND g.warehouseStatus <> 'CANCELLED' "
         + "AND (g.type = 'PURCHASE_RETURN' OR (g.type = 'DAMAGE' AND g.damageSource = 'SUPPLIER')) "
         + "AND g.returnDate BETWEEN :from AND :to ORDER BY g.returnDate ASC, g.returnNumber ASC")
    List<GoodsReturn> findSupplierClaimsInPeriod(
            @Param("tenantId") UUID tenantId, @Param("supplierName") String supplierName,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    // Sales returns that the warehouse actually received — these are credit notes for GST, and
    // they reduce the output tax. A return still awaiting verification has not happened yet.
    @Query("SELECT DISTINCT g FROM GoodsReturn g JOIN FETCH g.items i JOIN FETCH i.product "
         + "LEFT JOIN FETCH g.referenceOrder o LEFT JOIN FETCH o.customer "
         + "WHERE g.tenant.id = :tenantId AND g.type = 'SALES_RETURN' "
         + "AND g.warehouseStatus = 'VERIFIED' AND g.returnDate BETWEEN :from AND :to "
         + "ORDER BY g.returnDate ASC, g.returnNumber ASC")
    List<GoodsReturn> findVerifiedSalesReturnsInPeriod(
            @Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
