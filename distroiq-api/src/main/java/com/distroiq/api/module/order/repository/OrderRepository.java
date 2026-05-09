package com.distroiq.api.module.order.repository;

import com.distroiq.api.module.order.entity.Order;
import com.distroiq.api.module.order.entity.OrderItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    Optional<Order> findByIdAndTenantId(UUID id, UUID tenantId);

    Page<Order> findByTenantIdAndStatus(UUID tenantId, Order.OrderStatus status, Pageable pageable);

    Page<Order> findByTenantId(UUID tenantId, Pageable pageable);

    List<Order> findByTenantIdAndSalesPersonIdAndOrderDate(UUID tenantId, UUID salesPersonId, java.time.LocalDate date);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status IN (:statuses) AND o.customer.route.id IN (:routeIds)")
    List<Order> findByTenantIdAndStatusInAndRouteIds(
        @Param("tenantId") UUID tenantId,
        @Param("statuses") List<Order.OrderStatus> statuses,
        @Param("routeIds") List<UUID> routeIds);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(o.orderNumber, 10) AS int)), 0) FROM Order o WHERE o.tenant.id = :tenantId")
    int findMaxOrderSequence(@Param("tenantId") UUID tenantId);

    @Query("SELECT COALESCE(SUM(o.balanceAmount), 0) FROM Order o WHERE o.tenant.id = :tenantId AND o.customer.id = :customerId AND o.status <> :cancelled AND o.balanceAmount > 0")
    java.math.BigDecimal findTotalOutstandingByCustomer(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.customer.id = :customerId AND o.status <> :cancelled AND o.balanceAmount > 0 ORDER BY o.orderDate ASC")
    List<Order> findUnpaidOrdersByCustomer(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT i FROM OrderItem i WHERE i.order.tenant.id = :tenantId AND i.order.orderDate BETWEEN :from AND :to AND i.order.status <> :cancelled")
    List<OrderItem> findItemsByTenantAndDateRange(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.orderDate BETWEEN :from AND :to AND o.status <> :cancelled")
    List<Order> findByTenantAndDateRange(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.customer.id = :customerId AND o.orderDate BETWEEN :from AND :to AND o.status <> :cancelled ORDER BY o.orderDate ASC")
    List<Order> findByTenantAndCustomerAndDateRange(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.customer.id = :customerId AND o.orderDate < :from AND o.status <> :cancelled ORDER BY o.orderDate ASC")
    List<Order> findByTenantAndCustomerBeforeDate(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("from") LocalDate from, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o.customer.id, o.customer.businessName, o.customer.ownerName, o.customer.phone, " +
           "o.customer.route.name, SUM(o.totalAmount), SUM(o.paidAmount), SUM(o.balanceAmount), " +
           "MAX(o.orderDate), COUNT(o) " +
           "FROM Order o WHERE o.tenant.id = :tenantId AND o.status <> :cancelled AND o.balanceAmount > 0 " +
           "GROUP BY o.customer.id, o.customer.businessName, o.customer.ownerName, o.customer.phone, o.customer.route.name " +
           "ORDER BY SUM(o.balanceAmount) DESC")
    List<Object[]> findCustomerOutstanding(@Param("tenantId") UUID tenantId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId " +
           "AND (:status IS NULL OR o.status = :status) " +
           "AND (:from IS NULL OR o.orderDate >= :from) " +
           "AND (:to IS NULL OR o.orderDate <= :to) " +
           "ORDER BY o.createdAt DESC")
    Page<Order> findFiltered(
            @Param("tenantId") UUID tenantId,
            @Param("status") Order.OrderStatus status,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            Pageable pageable);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.salesPerson.id = :salesPersonId AND FUNCTION('MONTH', o.orderDate) = :month AND FUNCTION('YEAR', o.orderDate) = :year AND o.status <> :cancelled")
    List<Order> findByTenantAndSalesPersonAndMonthYear(@Param("tenantId") UUID tenantId, @Param("salesPersonId") UUID salesPersonId, @Param("month") int month, @Param("year") int year, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT DISTINCT o FROM Order o JOIN FETCH o.customer c JOIN FETCH c.route LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.product WHERE o.tenant.id = :tenantId AND o.orderDate = :date AND o.status IN :statuses AND c.route IS NOT NULL ORDER BY c.route.name ASC, c.businessName ASC")
    List<Order> findByTenantDateAndStatuses(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date, @Param("statuses") List<Order.OrderStatus> statuses);

    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items WHERE o.tenant.id = :tenantId AND o.customer.route.id = :routeId AND o.orderDate = :date AND o.status = :status")
    List<Order> findByTenantRouteAndDateAndStatus(@Param("tenantId") UUID tenantId, @Param("routeId") UUID routeId, @Param("date") LocalDate date, @Param("status") Order.OrderStatus status);
}
