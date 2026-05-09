package com.distroiq.api.module.accounting.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public class AccountingDtos {

    @Data
    public static class SalesReportResponse {
        private LocalDate fromDate;
        private LocalDate toDate;
        private BigDecimal totalSales;
        private BigDecimal totalGst;
        private long totalOrders;
        private List<ProductSalesSummary> topProducts;
        private List<DailySalesSummary> dailyTrends;
    }

    @Data
    public static class ProductSalesSummary {
        private String productName;
        private Integer quantity;
        private BigDecimal totalValue;
    }

    @Data
    public static class DailySalesSummary {
        private LocalDate date;
        private BigDecimal totalValue;
        private long orderCount;
    }

    @Data
    public static class CollectionReportResponse {
        private LocalDate fromDate;
        private LocalDate toDate;
        private BigDecimal totalCollected;
        private Map<String, BigDecimal> modeSummary; // CASH, UPI, etc.
        private List<PersonCollectionSummary> staffSummary;
    }

    @Data
    public static class PersonCollectionSummary {
        private String personName;
        private String role;
        private BigDecimal totalCollected;
    }
}
