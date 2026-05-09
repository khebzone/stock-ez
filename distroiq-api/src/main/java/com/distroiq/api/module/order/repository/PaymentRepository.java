package com.distroiq.api.module.order.repository;

import com.distroiq.api.module.order.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    List<Payment> findByTenantIdAndCollectionDate(UUID tenantId, LocalDate date);

    List<Payment> findByTenantIdAndCollectedByIdAndClearedFalse(UUID tenantId, UUID collectedById);

    List<Payment> findByOrderId(UUID orderId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.tenant.id = :tenantId AND p.collectedBy.id = :userId AND p.collectionDate = :date AND p.cleared = false")
    BigDecimal sumUnclearedByPersonAndDate(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId, @Param("date") LocalDate date);

    List<Payment> findByIdInAndTenantId(List<UUID> ids, UUID tenantId);

    // Today's collections for a person (for my-day summary)
    List<Payment> findByTenantIdAndCollectedByIdAndCollectionDate(UUID tenantId, UUID collectedById, LocalDate date);

    // Submitted but not yet cleared (accountant verification view)
    List<Payment> findByTenantIdAndSubmittedTrueAndClearedFalse(UUID tenantId);

    List<Payment> findByTenantIdAndOrder_CustomerIdOrderByCollectionDateAsc(UUID tenantId, UUID customerId);

    @Query("SELECT p FROM Payment p WHERE p.tenant.id = :tenantId AND p.order.customer.id = :customerId AND p.collectionDate BETWEEN :from AND :to ORDER BY p.collectionDate ASC")
    List<Payment> findByTenantAndCustomerAndDateRange(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT p FROM Payment p WHERE p.tenant.id = :tenantId AND p.order.customer.id = :customerId AND p.collectionDate < :from ORDER BY p.collectionDate ASC")
    List<Payment> findByTenantAndCustomerBeforeDate(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("from") LocalDate from);

    @Query("SELECT p.order.customer.id, MAX(p.collectionDate) FROM Payment p WHERE p.tenant.id = :tenantId GROUP BY p.order.customer.id")
    List<Object[]> findLastPaymentDateByCustomer(@Param("tenantId") UUID tenantId);
}
