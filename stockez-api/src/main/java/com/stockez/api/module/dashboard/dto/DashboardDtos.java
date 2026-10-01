package com.stockez.api.module.dashboard.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
public class DashboardDtos {

    @Data
    public static class AdminDashboardStats {
        private BigDecimal todaySales;
        private long todayOrders;
        private BigDecimal todayCollection;
        private long activeCustomers;
        private long activeStaff;
        private Map<String, Long> ordersByStatus;
        private long nearExpiryBatches;
        private long expiredBatches;
        // Quick stats
        private long totalProducts;
        private long totalRoutes;
        private long pendingOrders;
        private long totalUsers;
        private BigDecimal totalOutstanding;
        private BigDecimal overdueAmount;
        // Enhanced dashboard
        private List<TopOverdueCustomer> topOverdueCustomers;
        private List<RouteCollectionStat> routeStats;
        private BigDecimal totalVendorPayable;
    }

    @Data
    public static class TopOverdueCustomer {
        private UUID customerId;
        private String businessName;
        private String phone;
        private BigDecimal overdueAmount;
        private int oldestDueDays;
    }

    @Data
    public static class RouteCollectionStat {
        private String routeName;
        private long todayOrders;
        private BigDecimal todayCollection;
        private BigDecimal outstanding;
    }

    @Data
    public static class SalesDashboardStats {
        private BigDecimal myTodaySales;
        private long myTodayOrders;
        private BigDecimal myTodayCollection;
        private long myTotalCustomers;
        private String currentRoute;
    }

    @Data
    public static class WarehouseDashboardStats {
        private long pendingForApproval;
        private long pendingForPreparation;
        private long currentlyPacking;
        private long readyForDispatch;
    }
}
