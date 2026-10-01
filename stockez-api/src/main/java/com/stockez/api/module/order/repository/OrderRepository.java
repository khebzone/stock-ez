package com.stockez.api.module.order.repository;

import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.OrderItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
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

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.salesPerson.id = :salesPersonId AND o.orderDate = :date AND o.openingBalance = false")
    List<Order> findByTenantIdAndSalesPersonIdAndOrderDate(@Param("tenantId") UUID tenantId, @Param("salesPersonId") UUID salesPersonId, @Param("date") java.time.LocalDate date);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status IN (:statuses) AND o.customer.route.id IN (:routeIds)")
    List<Order> findByTenantIdAndStatusInAndRouteIds(
        @Param("tenantId") UUID tenantId,
        @Param("statuses") List<Order.OrderStatus> statuses,
        @Param("routeIds") List<UUID> routeIds);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status IN (:statuses) AND o.customer.route.id IN (:routeIds) AND o.orderDate = :date")
    List<Order> findByTenantIdAndStatusInAndRouteIdsAndDate(
        @Param("tenantId") UUID tenantId,
        @Param("statuses") List<Order.OrderStatus> statuses,
        @Param("routeIds") List<UUID> routeIds,
        @Param("date") LocalDate date);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status IN (:statuses) AND o.routeAllocation.id IN (:allocationIds)")
    List<Order> findByTenantIdAndStatusInAndRouteAllocationIdIn(
        @Param("tenantId") UUID tenantId,
        @Param("statuses") List<Order.OrderStatus> statuses,
        @Param("allocationIds") List<UUID> allocationIds);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status = :status AND o.customer.route.id = :routeId AND o.routeAllocation IS NULL")
    List<Order> findByTenantIdAndStatusAndRouteIdAndRouteAllocationIsNull(
        @Param("tenantId") UUID tenantId,
        @Param("status") Order.OrderStatus status,
        @Param("routeId") UUID routeId);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status IN (:statuses) AND o.customer.route.id = :routeId " +
           "AND (o.routeAllocation IS NULL OR o.routeAllocation.id <> :allocationId)")
    List<Order> findByTenantIdAndStatusInAndRouteIdAndNotStampedToAllocation(
        @Param("tenantId") UUID tenantId,
        @Param("statuses") List<Order.OrderStatus> statuses,
        @Param("routeId") UUID routeId,
        @Param("allocationId") UUID allocationId);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status = :status AND o.routeAllocation.id = :allocationId")
    List<Order> findByTenantIdAndStatusAndRouteAllocationId(
        @Param("tenantId") UUID tenantId,
        @Param("status") Order.OrderStatus status,
        @Param("allocationId") UUID allocationId);

    // Every order still stamped to one of these allocations, regardless of current status
    // (except cancelled). The stamp persists through PACKED→DISPATCHED→DELIVERED, so this
    // gives a stable historical "how many were assigned to this run" count for any date.
    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.routeAllocation.id IN (:allocationIds) AND o.status <> :excluded")
    List<Order> findByTenantIdAndRouteAllocationIdInAndStatusNot(
        @Param("tenantId") UUID tenantId,
        @Param("allocationIds") List<UUID> allocationIds,
        @Param("excluded") Order.OrderStatus excluded);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.tenant.id = :tenantId AND o.routeAllocation.id = :allocationId AND o.status <> :cancelled")
    long countRunOrders(@Param("tenantId") UUID tenantId, @Param("allocationId") UUID allocationId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.tenant.id = :tenantId AND o.routeAllocation.id = :allocationId AND o.status = :status")
    long countRunOrdersByStatus(@Param("tenantId") UUID tenantId, @Param("allocationId") UUID allocationId, @Param("status") Order.OrderStatus status);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status = 'DELIVERED' AND o.customer.route.id IN (:routeIds) AND o.orderDate = :date")
    List<Order> findDeliveredByRouteIdsAndDate(
        @Param("tenantId") UUID tenantId,
        @Param("routeIds") List<UUID> routeIds,
        @Param("date") LocalDate date);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(o.orderNumber, 10) AS int)), 0) FROM Order o WHERE o.tenant.id = :tenantId")
    int findMaxOrderSequence(@Param("tenantId") UUID tenantId);

    @Query("SELECT COALESCE(SUM(o.balanceAmount), 0) FROM Order o WHERE o.tenant.id = :tenantId AND o.customer.id = :customerId AND o.status <> :cancelled AND o.balanceAmount > 0")
    java.math.BigDecimal findTotalOutstandingByCustomer(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.customer.id = :customerId AND o.status <> :cancelled AND o.balanceAmount > 0 ORDER BY o.orderDate ASC")
    List<Order> findUnpaidOrdersByCustomer(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("cancelled") Order.OrderStatus cancelled);

    // Migrated opening-balance rows (OPN-...) that still carry a balance — an old-stock return credit is applied against these, oldest first.
    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.customer.id = :customerId AND o.openingBalance = true AND o.status <> :cancelled AND o.balanceAmount > 0 ORDER BY o.orderDate ASC")
    List<Order> findOpeningBalanceOutstandingByCustomer(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT i FROM OrderItem i WHERE i.order.tenant.id = :tenantId AND i.order.orderDate BETWEEN :from AND :to AND i.order.status <> :cancelled AND i.order.openingBalance = false")
    List<OrderItem> findItemsByTenantAndDateRange(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.orderDate BETWEEN :from AND :to AND o.status <> :cancelled AND o.openingBalance = false")
    List<Order> findByTenantAndDateRange(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.customer.id = :customerId AND o.orderDate BETWEEN :from AND :to AND o.status <> :cancelled ORDER BY o.orderDate ASC")
    List<Order> findByTenantAndCustomerAndDateRange(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.customer.id = :customerId AND o.orderDate < :from AND o.status <> :cancelled ORDER BY o.orderDate ASC")
    List<Order> findByTenantAndCustomerBeforeDate(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("from") LocalDate from, @Param("cancelled") Order.OrderStatus cancelled);

    List<Order> findByTenantIdAndStatusNotAndBalanceAmountGreaterThan(UUID tenantId, Order.OrderStatus status, java.math.BigDecimal amount);

    @Query("SELECT COALESCE(SUM(o.balanceAmount), 0) FROM Order o WHERE o.tenant.id = :tenantId AND o.status <> :cancelled AND o.balanceAmount > 0")
    java.math.BigDecimal findTotalOutstandingByTenant(@Param("tenantId") UUID tenantId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT COALESCE(SUM(o.balanceAmount), 0) FROM Order o WHERE o.tenant.id = :tenantId AND o.status <> :cancelled AND o.balanceAmount > 0 AND o.orderDate < :cutoff")
    java.math.BigDecimal findOverdueByTenant(@Param("tenantId") UUID tenantId, @Param("cancelled") Order.OrderStatus cancelled, @Param("cutoff") LocalDate cutoff);

    @Query("SELECT o.customer.route.id, o.customer.route.name, COUNT(o), COALESCE(SUM(o.totalAmount), 0) " +
           "FROM Order o WHERE o.tenant.id = :tenantId AND o.orderDate = :today " +
           "AND o.status <> :cancelled AND o.customer.route IS NOT NULL AND o.openingBalance = false " +
           "GROUP BY o.customer.route.id, o.customer.route.name ORDER BY SUM(o.totalAmount) DESC")
    List<Object[]> findTodayOrdersByRoute(@Param("tenantId") UUID tenantId, @Param("today") LocalDate today, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o.customer.route.id, COALESCE(SUM(o.balanceAmount), 0) " +
           "FROM Order o WHERE o.tenant.id = :tenantId AND o.status <> :cancelled " +
           "AND o.balanceAmount > 0 AND o.customer.route IS NOT NULL " +
           "GROUP BY o.customer.route.id")
    List<Object[]> findOutstandingByRoute(@Param("tenantId") UUID tenantId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o " +
           "LEFT JOIN o.customer c " +
           "LEFT JOIN c.route r " +
           "LEFT JOIN o.salesPerson sp " +
           "WHERE o.tenant.id = :tenantId " +
           "AND o.openingBalance = false " +
           "AND (:status IS NULL OR o.status = :status) " +
           "AND o.orderDate >= :from " +
           "AND o.orderDate <= :to " +
           "AND (:salesPersonId IS NULL OR sp.id = :salesPersonId) " +
           "AND (:routeId IS NULL OR r.id = :routeId) " +
           "AND (:search IS NULL OR LOWER(o.orderNumber) LIKE :search OR LOWER(c.businessName) LIKE :search OR c.phone LIKE :search) " +
           "ORDER BY o.createdAt DESC")
    Page<Order> findFiltered(
            @Param("tenantId") UUID tenantId,
            @Param("status") Order.OrderStatus status,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("salesPersonId") UUID salesPersonId,
            @Param("routeId") UUID routeId,
            @Param("search") String search,
            Pageable pageable);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.salesPerson.id = :salesPersonId AND o.orderDate >= :from AND o.orderDate <= :to AND o.status <> :cancelled AND o.openingBalance = false")
    List<Order> findByTenantAndSalesPersonAndMonthYear(@Param("tenantId") UUID tenantId, @Param("salesPersonId") UUID salesPersonId, @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.orderDate BETWEEN :from AND :to AND o.status = :status AND o.openingBalance = false")
    List<Order> findByTenantDateRangeAndStatus(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("status") Order.OrderStatus status);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status = :status AND o.returnedAt >= :from AND o.returnedAt < :to")
    List<Order> findByTenantAndStatusAndReturnedAtRange(@Param("tenantId") UUID tenantId, @Param("status") Order.OrderStatus status, @Param("from") Instant from, @Param("to") Instant to);

    // All open returns awaiting warehouse action, newest first (task queue, not date-scoped).
    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status = :status ORDER BY o.returnedAt DESC")
    List<Order> findByTenantAndStatusOrderByReturnedAt(@Param("tenantId") UUID tenantId, @Param("status") Order.OrderStatus status);

    @Query("SELECT DISTINCT o FROM Order o JOIN FETCH o.customer c JOIN FETCH c.route LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.product WHERE o.tenant.id = :tenantId AND o.orderDate = :date AND o.status IN :statuses AND c.route IS NOT NULL ORDER BY c.route.name ASC, c.businessName ASC")
    List<Order> findByTenantDateAndStatuses(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date, @Param("statuses") List<Order.OrderStatus> statuses);

    // Live backlog — every order on any route still needing warehouse work, regardless of
    // which day it was placed (an order approved days ago and still unpacked must keep showing).
    @Query("SELECT DISTINCT o FROM Order o JOIN FETCH o.customer c JOIN FETCH c.route LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.product WHERE o.tenant.id = :tenantId AND o.status IN :statuses AND c.route IS NOT NULL ORDER BY c.route.name ASC, c.businessName ASC")
    List<Order> findByTenantIdAndStatusesWithDetails(@Param("tenantId") UUID tenantId, @Param("statuses") List<Order.OrderStatus> statuses);

    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items WHERE o.tenant.id = :tenantId AND o.customer.route.id = :routeId AND o.orderDate = :date AND o.status = :status")
    List<Order> findByTenantRouteAndDateAndStatus(@Param("tenantId") UUID tenantId, @Param("routeId") UUID routeId, @Param("date") LocalDate date, @Param("status") Order.OrderStatus status);

    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items WHERE o.tenant.id = :tenantId AND o.customer.route.id = :routeId AND o.status = :status")
    List<Order> findByTenantRouteAndStatus(@Param("tenantId") UUID tenantId, @Param("routeId") UUID routeId, @Param("status") Order.OrderStatus status);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.status IN :statuses AND o.customer.route IS NOT NULL")
    List<Order> findByTenantIdAndStatusIn(@Param("tenantId") UUID tenantId, @Param("statuses") List<Order.OrderStatus> statuses);

    @Query("SELECT COALESCE(SUM(oi.lineTotal), 0) FROM OrderItem oi " +
           "WHERE oi.order.tenant.id = :tenantId " +
           "AND oi.order.salesPerson.id = :salesPersonId " +
           "AND oi.product.brandMaster.name = :brand " +
           "AND oi.order.orderDate BETWEEN :from AND :to " +
           "AND oi.order.status IN :statuses")
    java.math.BigDecimal sumBrandSalesByPerson(
            @Param("tenantId") UUID tenantId,
            @Param("salesPersonId") UUID salesPersonId,
            @Param("brand") String brand,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("statuses") List<Order.OrderStatus> statuses);

    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.product p LEFT JOIN FETCH p.brandMaster LEFT JOIN FETCH p.unitMaster " +
           "LEFT JOIN FETCH o.customer c LEFT JOIN FETCH c.route LEFT JOIN FETCH c.routePlace " +
           "LEFT JOIN FETCH o.salesPerson LEFT JOIN FETCH o.deliveryPerson LEFT JOIN FETCH o.tenant WHERE o.id = :id")
    Optional<Order> findByIdWithItems(@Param("id") UUID id);

    // All orders stamped to one delivery run, with items eagerly loaded, for bulk invoice printing.
    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.product p LEFT JOIN FETCH p.brandMaster LEFT JOIN FETCH p.unitMaster LEFT JOIN FETCH o.customer LEFT JOIN FETCH o.salesPerson LEFT JOIN FETCH o.deliveryPerson WHERE o.tenant.id = :tenantId AND o.routeAllocation.id = :allocationId AND o.status IN (:statuses) ORDER BY o.orderNumber ASC")
    List<Order> findRunInvoices(@Param("tenantId") UUID tenantId, @Param("allocationId") UUID allocationId, @Param("statuses") List<Order.OrderStatus> statuses);

    @Query("SELECT i.product.id, MAX(i.order.orderDate) FROM OrderItem i WHERE i.order.tenant.id = :tenantId AND i.order.status <> :cancelled AND i.order.openingBalance = false GROUP BY i.product.id")
    List<Object[]> findLastBilledDatePerProduct(@Param("tenantId") UUID tenantId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT i.product.id, i.order.salesPerson.id, MAX(i.order.orderDate) FROM OrderItem i WHERE i.order.tenant.id = :tenantId AND i.order.status <> :cancelled AND i.order.openingBalance = false GROUP BY i.product.id, i.order.salesPerson.id")
    List<Object[]> findLastBilledDatePerProductPerSalesperson(@Param("tenantId") UUID tenantId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT oi.product.id, oi.unitPrice, oi.order.orderDate FROM OrderItem oi WHERE oi.order.tenant.id = :tenantId AND oi.order.customer.id = :customerId AND oi.order.status <> :cancelled AND oi.order.openingBalance = false ORDER BY oi.order.orderDate DESC")
    List<Object[]> findAllBilledPricesForCustomer(@Param("tenantId") UUID tenantId, @Param("customerId") UUID customerId, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT i FROM OrderItem i JOIN FETCH i.product JOIN FETCH i.order o JOIN FETCH o.customer WHERE o.tenant.id = :tenantId AND o.orderDate BETWEEN :from AND :to AND o.status = :status AND o.openingBalance = false ORDER BY o.orderDate ASC, o.orderNumber ASC")
    List<OrderItem> findDeliveredItemsByTenantAndDateRange(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("status") Order.OrderStatus status);

    // GST reports go by INVOICE date and cover every invoice that has been raised — the bill is
    // generated at APPROVED, so liability starts there, not at delivery. The caller passes the
    // reportable statuses; DRAFT/SUBMITTED have no bill yet and CANCELLED ones are not supplies.
    @Query("SELECT i FROM OrderItem i JOIN FETCH i.product p LEFT JOIN FETCH p.unitMaster "
         + "JOIN FETCH i.order o JOIN FETCH o.customer "
         + "WHERE o.tenant.id = :tenantId AND o.orderDate BETWEEN :from AND :to "
         + "AND o.status IN :statuses AND o.openingBalance = false "
         + "ORDER BY o.orderDate ASC, o.orderNumber ASC")
    List<OrderItem> findInvoicedItemsByTenantAndDateRange(
            @Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to,
            @Param("statuses") java.util.Collection<Order.OrderStatus> statuses);

    // Bills raised but never delivered — the goods came back because the shop was shut. They are
    // still invoices in the system, so the GST report flags them rather than silently dropping them.
    @Query("SELECT o FROM Order o JOIN FETCH o.customer WHERE o.tenant.id = :tenantId "
         + "AND o.orderDate BETWEEN :from AND :to AND o.status = :status AND o.openingBalance = false "
         + "ORDER BY o.orderDate ASC")
    List<Order> findByTenantAndDateRangeAndSingleStatus(
            @Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to,
            @Param("status") Order.OrderStatus status);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId AND o.openingBalance = false AND (:status IS NULL OR o.status = :status) ORDER BY o.createdAt DESC")
    List<Order> findAllFiltered(@Param("tenantId") UUID tenantId, @Param("status") Order.OrderStatus status);

    @Query("SELECT DISTINCT o FROM Order o JOIN FETCH o.salesPerson JOIN FETCH o.customer WHERE o.tenant.id = :tenantId AND o.orderDate = :date AND o.status <> :cancelled AND o.openingBalance = false ORDER BY o.salesPerson.fullName ASC, o.orderNumber ASC")
    List<Order> findDailyOrders(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date, @Param("cancelled") Order.OrderStatus cancelled);

    // Real dispatch flow stamps the delivery person onto the RouteAllocation, not always onto the
    // order itself (Order.deliveryPerson is only set via the separate assignDelivery action, which
    // most tenants never call) — so a LEFT JOIN + fallback in ReportService.resolveDeliveryPerson()
    // is required, not just o.deliveryPerson directly.
    @Query("SELECT DISTINCT o FROM Order o " +
           "LEFT JOIN FETCH o.deliveryPerson " +
           "LEFT JOIN FETCH o.routeAllocation ra " +
           "LEFT JOIN FETCH ra.deliveryPerson " +
           "JOIN FETCH o.customer " +
           "WHERE o.tenant.id = :tenantId AND o.orderDate = :date AND o.status IN :statuses " +
           "AND (o.deliveryPerson IS NOT NULL OR ra.deliveryPerson IS NOT NULL) AND o.openingBalance = false " +
           "ORDER BY o.orderNumber ASC")
    List<Order> findDailyDeliveryOrders(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date, @Param("statuses") List<Order.OrderStatus> statuses);

    @Query("SELECT DISTINCT oi.product.brandMaster.name FROM OrderItem oi " +
           "WHERE oi.order.tenant.id = :tenantId " +
           "AND oi.order.salesPerson.id = :salesPersonId " +
           "AND oi.order.orderDate BETWEEN :from AND :to " +
           "AND oi.order.status IN :statuses " +
           "AND oi.order.openingBalance = false " +
           "AND oi.product.brandMaster IS NOT NULL")
    List<String> findDistinctBrandsBySalesPerson(
            @Param("tenantId") UUID tenantId,
            @Param("salesPersonId") UUID salesPersonId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("statuses") List<Order.OrderStatus> statuses);

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0), COUNT(o) FROM Order o " +
           "WHERE o.tenant.id = :tenantId AND o.orderDate = :date AND o.openingBalance = false AND o.status <> :cancelled")
    List<Object[]> findDayOrderTotals(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o FROM Order o WHERE o.tenant.id = :tenantId " +
           "AND o.orderDate BETWEEN :from AND :to AND o.status <> :cancelled")
    List<Order> findByTenantAndDateRangeAllOrders(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("cancelled") Order.OrderStatus cancelled);

    @Query("SELECT o.status, COUNT(o) FROM Order o " +
           "WHERE o.tenant.id = :tenantId AND o.openingBalance = false GROUP BY o.status")
    List<Object[]> countOrdersByStatus(@Param("tenantId") UUID tenantId);

    @Query("SELECT DISTINCT o.salesPerson.id, o.salesPerson.fullName FROM Order o " +
           "WHERE o.tenant.id = :tenantId AND o.salesPerson IS NOT NULL AND o.openingBalance = false " +
           "ORDER BY o.salesPerson.fullName ASC")
    List<Object[]> findDistinctSalespersons(@Param("tenantId") UUID tenantId);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.tenant.id = :tenantId AND o.status = :status")
    long countByTenantIdAndStatus(@Param("tenantId") UUID tenantId, @Param("status") Order.OrderStatus status);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.tenant.id = :tenantId AND o.status IN :statuses")
    long countByTenantIdAndStatusIn(@Param("tenantId") UUID tenantId, @Param("statuses") java.util.List<Order.OrderStatus> statuses);
}
