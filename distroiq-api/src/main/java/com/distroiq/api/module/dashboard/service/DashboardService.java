package com.distroiq.api.module.dashboard.service;

import com.distroiq.api.module.customer.repository.CustomerRepository;
import com.distroiq.api.module.dashboard.dto.DashboardDtos;
import com.distroiq.api.module.order.entity.Order;
import com.distroiq.api.module.order.repository.OrderRepository;
import com.distroiq.api.module.order.repository.PaymentRepository;
import com.distroiq.api.module.product.repository.ProductRepository;
import com.distroiq.api.module.purchase.repository.StockBatchRepository;
import com.distroiq.api.module.route.repository.RouteRepository;
import com.distroiq.api.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.distroiq.api.module.user.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    public DashboardDtos.AdminDashboardStats getAdminStats(UUID tenantId) {
        LocalDate today = LocalDate.now();
        List<Order> todayOrders = orderRepository.findAll().stream()
                .filter(o -> o.getTenant().getId().equals(tenantId))
                .filter(o -> o.getOrderDate().equals(today))
                .collect(Collectors.toList());

        DashboardDtos.AdminDashboardStats stats = new DashboardDtos.AdminDashboardStats();
        stats.setTodaySales(todayOrders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
        stats.setTodayOrders(todayOrders.size());
        
        stats.setTodayCollection(paymentRepository.findByTenantIdAndCollectionDate(tenantId, today).stream()
                .map(p -> p.getAmount()).reduce(BigDecimal.ZERO, BigDecimal::add));

        stats.setOrdersByStatus(orderRepository.findAll().stream()
                .filter(o -> o.getTenant().getId().equals(tenantId))
                .collect(Collectors.groupingBy(o -> o.getStatus().name(), Collectors.counting())));

        LocalDate alertDate = today.plusDays(30);
        stats.setNearExpiryBatches(stockBatchRepository.findNearExpiry(tenantId, alertDate).size());
        stats.setExpiredBatches(stockBatchRepository.findNearExpiry(tenantId, today.minusDays(1)).stream()
                .filter(b -> b.getExpiryDate().isBefore(today)).count());

        stats.setActiveCustomers(customerRepository.countByTenantIdAndActiveTrue(tenantId));
        stats.setTotalProducts(productRepository.countByTenantIdAndActiveTrue(tenantId));
        stats.setTotalRoutes(routeRepository.findByTenantIdAndActiveTrue(tenantId).size());
        stats.setTotalUsers(userRepository.countByTenantIdAndActiveTrueAndRoleNotIn(
                tenantId, List.of(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN)));
        stats.setPendingOrders(orderRepository.findAll().stream()
                .filter(o -> o.getTenant().getId().equals(tenantId))
                .filter(o -> o.getStatus() == Order.OrderStatus.SUBMITTED || o.getStatus() == Order.OrderStatus.APPROVED)
                .count());

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
                .map(p -> p.getAmount()).reduce(BigDecimal.ZERO, BigDecimal::add));
        
        return stats;
    }

    public DashboardDtos.WarehouseDashboardStats getWarehouseStats(UUID tenantId) {
        DashboardDtos.WarehouseDashboardStats stats = new DashboardDtos.WarehouseDashboardStats();
        Map<String, Long> statusCount = orderRepository.findAll().stream()
                .filter(o -> o.getTenant().getId().equals(tenantId))
                .collect(Collectors.groupingBy(o -> o.getStatus().name(), Collectors.counting()));
        
        stats.setPendingForPreparation(statusCount.getOrDefault("APPROVED", 0L));
        stats.setCurrentlyPreparing(statusCount.getOrDefault("PREPARING", 0L));
        stats.setReadyForDispatch(statusCount.getOrDefault("PREPARED", 0L));
        return stats;
    }
}
