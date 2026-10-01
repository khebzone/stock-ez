package com.stockez.api.module.dashboard.service;

import com.stockez.api.module.customer.repository.CustomerRepository;
import com.stockez.api.module.dashboard.dto.DashboardDtos;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.repository.PurchaseEntryRepository;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.purchase.repository.SupplierPaymentRepository;
import com.stockez.api.module.route.repository.RouteRepository;
import com.stockez.api.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stockez.api.module.user.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final CustomerRepository customerRepository;
    private final UserRepository userRepository;
    private final StockBatchRepository stockBatchRepository;
    private final ProductRepository productRepository;
    private final RouteRepository routeRepository;
    private final PurchaseEntryRepository purchaseEntryRepository;
    private final SupplierPaymentRepository supplierPaymentRepository;

    public DashboardDtos.AdminDashboardStats getAdminStats(UUID tenantId) {
        LocalDate today = LocalDate.now();

        DashboardDtos.AdminDashboardStats stats = new DashboardDtos.AdminDashboardStats();

        List<Object[]> dayTotals = orderRepository.findDayOrderTotals(tenantId, today, Order.OrderStatus.CANCELLED);
        Object[] dt = dayTotals.isEmpty() ? null : dayTotals.get(0);
        stats.setTodaySales(dt != null && dt[0] != null ? new BigDecimal(dt[0].toString()) : BigDecimal.ZERO);
        stats.setTodayOrders(dt != null && dt[1] != null ? ((Number) dt[1]).intValue() : 0);

        stats.setTodayCollection(paymentRepository.findByTenantIdAndCollectionDate(tenantId, today).stream()
                .filter(p -> p.getPaymentMode() != com.stockez.api.module.order.entity.Payment.PaymentMode.CREDIT)
                .map(p -> p.getAmount()).reduce(BigDecimal.ZERO, BigDecimal::add));

        Map<String, Long> ordersByStatus = new HashMap<>();
        for (Object[] row : orderRepository.countOrdersByStatus(tenantId)) {
            ordersByStatus.put(((Order.OrderStatus) row[0]).name(), ((Number) row[1]).longValue());
        }
        stats.setOrdersByStatus(ordersByStatus);

        LocalDate alertDate = today.plusDays(30);
        stats.setNearExpiryBatches(stockBatchRepository.findNearExpiry(tenantId, alertDate).size());
        stats.setExpiredBatches(stockBatchRepository.findNearExpiry(tenantId, today.minusDays(1)).stream()
                .filter(b -> b.getExpiryDate().isBefore(today)).count());

        stats.setActiveCustomers(customerRepository.countByTenantIdAndActiveTrue(tenantId));
        stats.setTotalProducts(productRepository.countByTenantIdAndActiveTrue(tenantId));
        stats.setTotalRoutes(routeRepository.findByTenantIdAndActiveTrue(tenantId).size());
        stats.setTotalUsers(userRepository.countByTenantIdAndActiveTrueAndRoleNotIn(
                tenantId, List.of(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN)));
        stats.setPendingOrders(
                ordersByStatus.getOrDefault(Order.OrderStatus.SUBMITTED.name(), 0L)
                + ordersByStatus.getOrDefault(Order.OrderStatus.APPROVED.name(), 0L));

        stats.setTotalOutstanding(orderRepository.findTotalOutstandingByTenant(tenantId, Order.OrderStatus.CANCELLED));
        LocalDate overdueDate = today.minusDays(30);
        stats.setOverdueAmount(orderRepository.findOverdueByTenant(tenantId, Order.OrderStatus.CANCELLED, overdueDate));

        // Top 5 overdue customers (orders older than 30 days with balance remaining)
        List<Order> overdueOrders = orderRepository.findByTenantIdAndStatusNotAndBalanceAmountGreaterThan(
                tenantId, Order.OrderStatus.CANCELLED, BigDecimal.ZERO).stream()
                .filter(o -> o.getOrderDate().isBefore(overdueDate))
                .collect(Collectors.toList());
        Map<UUID, List<Order>> byCustomer = overdueOrders.stream()
                .collect(Collectors.groupingBy(o -> o.getCustomer().getId()));
        stats.setTopOverdueCustomers(byCustomer.entrySet().stream().map(e -> {
            List<Order> orders = e.getValue();
            BigDecimal total = orders.stream().map(Order::getBalanceAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            LocalDate oldest = orders.stream().map(Order::getOrderDate).min(Comparator.naturalOrder()).orElse(today);
            DashboardDtos.TopOverdueCustomer c = new DashboardDtos.TopOverdueCustomer();
            c.setCustomerId(e.getKey());
            c.setBusinessName(orders.get(0).getCustomer().getBusinessName());
            c.setPhone(orders.get(0).getCustomer().getPhone());
            c.setOverdueAmount(total);
            c.setOldestDueDays((int) ChronoUnit.DAYS.between(oldest, today));
            return c;
        }).sorted(Comparator.comparing(DashboardDtos.TopOverdueCustomer::getOverdueAmount).reversed())
                .limit(5).collect(Collectors.toList()));

        // Route-wise collection stats for today
        List<Object[]> routeOrders = orderRepository.findTodayOrdersByRoute(tenantId, today, Order.OrderStatus.CANCELLED);
        List<Object[]> routePayments = paymentRepository.findTodayCollectionsByRoute(tenantId, today);
        List<Object[]> routeOutstanding = orderRepository.findOutstandingByRoute(tenantId, Order.OrderStatus.CANCELLED);
        Map<UUID, BigDecimal> collectionMap = new HashMap<>();
        for (Object[] row : routePayments) collectionMap.put((UUID) row[0], (BigDecimal) row[1]);
        Map<UUID, BigDecimal> outstandingMap = new HashMap<>();
        for (Object[] row : routeOutstanding) outstandingMap.put((UUID) row[0], (BigDecimal) row[1]);
        stats.setRouteStats(routeOrders.stream().map(row -> {
            UUID routeId = (UUID) row[0];
            DashboardDtos.RouteCollectionStat stat = new DashboardDtos.RouteCollectionStat();
            stat.setRouteName((String) row[1]);
            stat.setTodayOrders(((Number) row[2]).longValue());
            stat.setTodayCollection(collectionMap.getOrDefault(routeId, BigDecimal.ZERO));
            stat.setOutstanding(outstandingMap.getOrDefault(routeId, BigDecimal.ZERO));
            return stat;
        }).sorted(Comparator.comparing(DashboardDtos.RouteCollectionStat::getOutstanding).reversed())
                .collect(Collectors.toList()));

        // Total vendor payable = total purchased - total paid to suppliers
        BigDecimal totalPurchased = purchaseEntryRepository.sumTotalPurchasedByTenant(tenantId);
        BigDecimal totalPaidToSuppliers = supplierPaymentRepository.sumTotalPaidByTenant(tenantId);
        stats.setTotalVendorPayable(totalPurchased.subtract(totalPaidToSuppliers).max(BigDecimal.ZERO));

        return stats;
    }

    public DashboardDtos.SalesDashboardStats getSalesStats(UUID tenantId, UUID salesPersonId) {
        LocalDate today = LocalDate.now();
        List<Order> myOrders = orderRepository.findByTenantIdAndSalesPersonIdAndOrderDate(tenantId, salesPersonId, today);

        DashboardDtos.SalesDashboardStats stats = new DashboardDtos.SalesDashboardStats();
        stats.setMyTodaySales(myOrders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
        stats.setMyTodayOrders(myOrders.size());
        
        stats.setMyTodayCollection(paymentRepository.findByTenantIdAndCollectionDate(tenantId, today).stream()
                .filter(p -> p.getCollectedBy().getId().equals(salesPersonId))
                .filter(p -> p.getPaymentMode() != com.stockez.api.module.order.entity.Payment.PaymentMode.CREDIT)
                .map(p -> p.getAmount()).reduce(BigDecimal.ZERO, BigDecimal::add));
        
        return stats;
    }

    public DashboardDtos.WarehouseDashboardStats getWarehouseStats(UUID tenantId) {
        DashboardDtos.WarehouseDashboardStats stats = new DashboardDtos.WarehouseDashboardStats();
        Map<String, Long> statusCount = new HashMap<>();
        for (Object[] row : orderRepository.countOrdersByStatus(tenantId)) {
            statusCount.put(((Order.OrderStatus) row[0]).name(), ((Number) row[1]).longValue());
        }

        stats.setPendingForPreparation(statusCount.getOrDefault("APPROVED", 0L));
        stats.setCurrentlyPacking(statusCount.getOrDefault("PACKING", 0L));
        stats.setReadyForDispatch(statusCount.getOrDefault("PACKED", 0L));
        return stats;
    }
}
