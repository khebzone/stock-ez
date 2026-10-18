package com.stockez.api.module.tracking.repository;

import com.stockez.api.module.tracking.entity.CustomerVisit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface CustomerVisitRepository extends JpaRepository<CustomerVisit, UUID> {

    @Query("SELECT v FROM CustomerVisit v JOIN FETCH v.customer JOIN FETCH v.user " +
           "WHERE v.tenant.id = :tenantId AND v.visitDate = :date ORDER BY v.visitedAt ASC")
    List<CustomerVisit> findForDay(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date);

    @Query("SELECT v FROM CustomerVisit v JOIN FETCH v.customer JOIN FETCH v.user " +
           "WHERE v.tenant.id = :tenantId AND v.visitDate = :date AND v.user.id = :userId " +
           "ORDER BY v.visitedAt ASC")
    List<CustomerVisit> findForDayAndUser(@Param("tenantId") UUID tenantId,
                                          @Param("date") LocalDate date,
                                          @Param("userId") UUID userId);

    @Query("SELECT v FROM CustomerVisit v JOIN FETCH v.user " +
           "WHERE v.tenant.id = :tenantId AND v.customer.id = :customerId " +
           "ORDER BY v.visitedAt DESC LIMIT 50")
    List<CustomerVisit> findRecentForCustomer(@Param("tenantId") UUID tenantId,
                                              @Param("customerId") UUID customerId);

    boolean existsByTenantIdAndUserIdAndCustomerIdAndVisitDate(
            UUID tenantId, UUID userId, UUID customerId, LocalDate visitDate);

    @Query("SELECT v.customer.id FROM CustomerVisit v WHERE v.tenant.id = :tenantId " +
           "AND v.user.id = :userId AND v.visitDate = :date")
    List<UUID> findVisitedCustomerIds(@Param("tenantId") UUID tenantId,
                                      @Param("userId") UUID userId,
                                      @Param("date") LocalDate date);
}
