package com.stockez.api.module.order.repository;

import com.stockez.api.module.order.entity.Payment;
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
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    @Query("SELECT p FROM Payment p JOIN FETCH p.tenant JOIN FETCH p.customer JOIN FETCH p.collectedBy LEFT JOIN FETCH p.order WHERE p.id = :id")
    Optional<Payment> findByIdWithDetails(@Param("id") UUID id);

    List<Payment> findByTenantIdAndCollectionDate(UUID tenantId, LocalDate date);

    List<Payment> findByTenantIdAndCollectedByIdAndClearedFalse(UUID tenantId, UUID collectedById);

    List<Payment> findByOrderId(UUID orderId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.tenant.id = :tenantId AND p.collectedBy.id = :userId AND p.collectionDate = :date AND p.cleared = false")
    BigDecimal sumUnclearedByPersonAndDate(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId, @Param("date") LocalDate date);

    List<Payment> findByIdInAndTenantId(List<UUID> ids, UUID tenantId);

    List<Payment> findByTenantIdAndCollectedByIdAndCollectionDate(UUID tenantId, UUID collectedById, LocalDate date);

    List<Payment> findByTenantIdAndCollectedByIdAndSubmittedFalse(UUID tenantId, UUID collectedById);

    boolean existsByTenantIdAndCollectedByIdAndCollectionDateAndSubmittedTrue(UUID tenantId, UUID collectedById, LocalDate date);

    List<Payment> findByTenantIdAndSubmittedTrueAndClearedFalse(UUID tenantId);

    List<Payment> findByTenantIdAndSubmittedFalse(UUID tenantId);

    @Query("SELECT p FROM Payment p " +
           "JOIN FETCH p.customer LEFT JOIN FETCH p.collectedBy LEFT JOIN FETCH p.order o " +
           "WHERE p.tenant.id = :tenantId " +
           "AND p.paymentMode IN (com.stockez.api.module.order.entity.Payment.PaymentMode.CHEQUE, " +
           "com.stockez.api.module.order.entity.Payment.PaymentMode.NEFT, " +
           "com.stockez.api.module.order.entity.Payment.PaymentMode.RTGS) " +
           "ORDER BY p.collectionDate DESC")
    List<Payment> findInstruments(@Param("tenantId") UUID tenantId);

    List<Payment> findByTenantIdAndCustomerIdOrderByCollectionDateAsc(UUID tenantId, UUID customerId);

    @Query("SELECT p FROM Payment p WHERE p.tenant.id = :tenantId AND p.customer.id = :customerId AND p.collectionDate BETWEEN :from AND :to ORDER BY p.collectionDate ASC")
    List<Payment> findByTenantAndCustomerAndDateRange(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT p FROM Payment p WHERE p.tenant.id = :tenantId AND p.customer.id = :customerId AND p.collectionDate < :from ORDER BY p.collectionDate ASC")
    List<Payment> findByTenantAndCustomerBeforeDate(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("from") LocalDate from);

    @Query("SELECT p.customer.id, MAX(p.collectionDate) FROM Payment p WHERE p.tenant.id = :tenantId GROUP BY p.customer.id")
    List<Object[]> findLastPaymentDateByCustomer(@Param("tenantId") UUID tenantId);

    @Query("SELECT p FROM Payment p WHERE p.tenant.id = :tenantId AND p.collectionDate BETWEEN :from AND :to ORDER BY p.collectionDate ASC")
    List<Payment> findByTenantAndDateRange(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT p FROM Payment p JOIN FETCH p.customer JOIN FETCH p.collectedBy LEFT JOIN FETCH p.order WHERE p.tenant.id = :tenantId AND p.collectionDate BETWEEN :from AND :to ORDER BY p.collectionDate ASC, p.customer.businessName ASC")
    List<Payment> findDetailByTenantAndDateRange(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT p FROM Payment p JOIN FETCH p.collectedBy JOIN FETCH p.customer LEFT JOIN FETCH p.order WHERE p.tenant.id = :tenantId AND p.collectionDate = :date ORDER BY p.collectedBy.fullName ASC, p.customer.businessName ASC")
    List<Payment> findDailyPayments(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.tenant.id = :tenantId AND p.collectedBy.id = :salesPersonId AND p.collectionDate BETWEEN :from AND :to")
    java.math.BigDecimal sumCollectionsByPerson(@Param("tenantId") UUID tenantId, @Param("salesPersonId") UUID salesPersonId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT p.customer.route.id, COALESCE(SUM(p.amount), 0) " +
           "FROM Payment p WHERE p.tenant.id = :tenantId AND p.collectionDate = :today " +
           "AND p.customer.route IS NOT NULL AND p.paymentMode <> com.stockez.api.module.order.entity.Payment.PaymentMode.CREDIT " +
           "GROUP BY p.customer.route.id")
    List<Object[]> findTodayCollectionsByRoute(@Param("tenantId") UUID tenantId, @Param("today") LocalDate today);

    @Query("SELECT COUNT(p) FROM Payment p WHERE p.tenant.id = :tenantId AND p.submitted = true AND p.cleared = false")
    long countPendingVerifications(@Param("tenantId") UUID tenantId);

    @Query("SELECT COUNT(p) FROM Payment p WHERE p.tenant.id = :tenantId AND p.status = 'PENDING'")
    long countPendingInstruments(@Param("tenantId") UUID tenantId);
}
