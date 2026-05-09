package com.distroiq.api.module.dashboard.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;

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
        private long currentlyPreparing;
        private long readyForDispatch;
    }
}
