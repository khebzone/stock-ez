package com.stockez.api.module.purchase.repository;

import com.stockez.api.module.purchase.entity.SupplierPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupplierPaymentRepository extends JpaRepository<SupplierPayment, UUID> {

    List<SupplierPayment> findByTenantIdOrderByPaymentDateDesc(UUID tenantId);

    @Query("SELECT sp FROM SupplierPayment sp WHERE sp.tenant.id = :tenantId " +
           "AND LOWER(sp.supplierName) LIKE :name " +
           "ORDER BY sp.paymentDate DESC")
    List<SupplierPayment> findByTenantAndSupplier(@Param("tenantId") UUID tenantId, @Param("name") String name);

    Optional<SupplierPayment> findByIdAndTenantId(UUID id, UUID tenantId);

    @Query("SELECT sp.supplierName, COALESCE(SUM(sp.amount), 0), MAX(sp.paymentDate) " +
           "FROM SupplierPayment sp WHERE sp.tenant.id = :tenantId GROUP BY sp.supplierName")
    List<Object[]> sumPaidBySupplier(@Param("tenantId") UUID tenantId);

    @Query("SELECT COALESCE(SUM(sp.amount), 0) FROM SupplierPayment sp WHERE sp.tenant.id = :tenantId")
    java.math.BigDecimal sumTotalPaidByTenant(@Param("tenantId") UUID tenantId);

    @Query("SELECT sp FROM SupplierPayment sp WHERE sp.tenant.id = :tenantId " +
           "AND LOWER(sp.supplierName) = LOWER(:supplierName) " +
           "AND sp.paymentDate BETWEEN :from AND :to ORDER BY sp.paymentDate ASC, sp.createdAt ASC")
    List<SupplierPayment> findByTenantAndSupplierAndDateRange(
            @Param("tenantId") UUID tenantId, @Param("supplierName") String supplierName,
            @Param("from") java.time.LocalDate from, @Param("to") java.time.LocalDate to);

    @Query("SELECT COALESCE(SUM(sp.amount), 0) FROM SupplierPayment sp WHERE sp.tenant.id = :tenantId " +
           "AND LOWER(sp.supplierName) = LOWER(:supplierName) AND sp.paymentDate < :from")
    java.math.BigDecimal sumPaidBySupplierBeforeDate(
            @Param("tenantId") UUID tenantId, @Param("supplierName") String supplierName, @Param("from") java.time.LocalDate from);
}
