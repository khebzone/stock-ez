package com.distroiq.api.module.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class ReportDtos {

    // ─── Aging Report ────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AgingRow {
        private UUID customerId;
        private String businessName;
        private String phone;
        private BigDecimal totalOutstanding;
        private BigDecimal bucket0to30;
        private BigDecimal bucket31to60;
        private BigDecimal bucket61to90;
        private BigDecimal bucket90plus;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AgingReportResponse {
        private List<AgingRow> rows;
        private BigDecimal summaryTotalOutstanding;
        private BigDecimal summaryBucket0to30;
        private BigDecimal summaryBucket31to60;
        private BigDecimal summaryBucket61to90;
        private BigDecimal summaryBucket90plus;
        private int totalCustomers;
    }

    // ─── Sales Trend ─────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyRevenue {
        private LocalDate date;
        private BigDecimal totalAmount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SalesTrendResponse {
        private List<DailyRevenue> dailyBreakdown;
    }

    // ─── Sales Analysis ───────────────────────────────────────────────────────

    public enum SalesGroupBy {
        SALESMAN, PRODUCT, CATEGORY
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SalesmanRow {
        private UUID salesPersonId;
        private String salesPersonName;
        private BigDecimal totalSales;
        private long orderCount;
        private long totalOrders;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductRow {
        private UUID productId;
        private String productName;
        private String brand;
        private int qtySold;
        private BigDecimal revenue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryRow {
        private String category;
        private int qtySold;
        private BigDecimal revenue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyTrendPoint {
        private LocalDate date;
        private BigDecimal totalSales;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SalesAnalysisResponse {
        private LocalDate from;
        private LocalDate to;
        private SalesGroupBy groupBy;
        // Only one of these will be populated depending on groupBy
        private List<SalesmanRow> salesmanRows;
        private List<ProductRow> productRows;
        private List<CategoryRow> categoryRows;
        private List<DailyTrendPoint> dailyTrend;
        private BigDecimal grandTotal;
        private long totalOrders;
    }

    // ─── Ledger Report ────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LedgerEntry {
        private LocalDate date;
        private String description;
        private BigDecimal debit;   // order amount
        private BigDecimal credit;  // payment amount
        private BigDecimal runningBalance;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CustomerLedgerResponse {
        private UUID customerId;
        private String businessName;
        private String phone;
        private LocalDate from;
        private LocalDate to;
        private BigDecimal openingBalance;
        private BigDecimal closingBalance;
        private List<LedgerEntry> entries;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VendorLedgerRow {
        private String supplierName;
        private int entryCount;
        private BigDecimal totalPurchases;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VendorLedgerResponse {
        private LocalDate from;
        private LocalDate to;
        private List<VendorLedgerRow> vendors;
        private BigDecimal grandTotal;
    }
}
