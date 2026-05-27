package com.stockez.api.module.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class ReportDtos {

    // ─── Aging Report ────────────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
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

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AgingSummary {
        private BigDecimal totalOutstanding;
        private BigDecimal bucket0to30;
        private BigDecimal bucket31to60;
        private BigDecimal bucket61to90;
        private BigDecimal bucket90plus;
        private int customerCount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AgingReportResponse {
        private List<AgingRow> rows;
        private AgingSummary summary;
    }

    // ─── Sales Trend ─────────────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyRevenue {
        private LocalDate date;
        private int orderCount;
        private BigDecimal subTotal;
        private BigDecimal totalGst;
        private BigDecimal totalAmount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SalesTrendResponse {
        private List<DailyRevenue> dailyBreakdown;
        private int totalOrders;
        private BigDecimal totalRevenue;
        private BigDecimal totalGst;
        private BigDecimal avgOrderValue;
    }

    // ─── Collection Report ───────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyCollection {
        private LocalDate date;
        private int paymentCount;
        private BigDecimal cashAmount;
        private BigDecimal upiAmount;
        private BigDecimal bankTransferAmount;
        private BigDecimal totalAmount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CollectionReportResponse {
        private List<DailyCollection> dailyBreakdown;
        private BigDecimal totalCollected;
        private BigDecimal totalCash;
        private BigDecimal totalDigital;
        private BigDecimal totalUncleared;
    }

    // ─── Sales Analysis ──────────────────────────────────────────────────────

    public enum SalesGroupBy {
        SALESMAN, PRODUCT, CATEGORY
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SalesmanRow {
        private UUID salesPersonId;
        private String salesPersonName;
        private BigDecimal totalSales;
        private long orderCount;
        private long totalOrders;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ProductRow {
        private UUID productId;
        private String productName;
        private String brand;
        private int qtySold;
        private BigDecimal revenue;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CategoryRow {
        private String category;
        private int qtySold;
        private BigDecimal revenue;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyTrendPoint {
        private LocalDate date;
        private BigDecimal totalSales;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SalesGroupRow {
        private String name;
        private String sub;
        private BigDecimal totalSales;
        private long orderCount;
        private int qtySold;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SalesKpi {
        private BigDecimal totalSales;
        private long totalOrders;
        private BigDecimal avgOrderValue;
        private String topPerformer;
        private BigDecimal topPerformerSales;
        private BigDecimal totalGst;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SalesAnalysisResponse {
        private LocalDate from;
        private LocalDate to;
        private SalesGroupBy groupBy;
        private List<SalesmanRow> salesmanRows;
        private List<ProductRow> productRows;
        private List<CategoryRow> categoryRows;
        private List<DailyTrendPoint> dailyTrend;
        private BigDecimal grandTotal;
        private long totalOrders;
        private List<SalesGroupRow> groups;
        private SalesKpi kpi;
    }

    // ─── Ledger Report ───────────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class LedgerEntry {
        private LocalDate date;
        private String description;
        private String type;   // "DEBIT" or "CREDIT"
        private BigDecimal amount;
        private String reference;
        private BigDecimal runningBalance;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CustomerLedgerResponse {
        private UUID customerId;
        private String businessName;
        private String phone;
        private LocalDate from;
        private LocalDate to;
        private BigDecimal openingBalance;
        private BigDecimal closingBalance;
        private BigDecimal totalDebit;
        private BigDecimal totalCredit;
        private List<LedgerEntry> entries;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class VendorLedgerRow {
        private String supplierName;
        private int entryCount;
        private BigDecimal totalAmount;
        private LocalDate lastPurchaseDate;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class VendorLedgerResponse {
        private LocalDate from;
        private LocalDate to;
        private List<VendorLedgerRow> vendors;
        private BigDecimal totalPurchases;
    }

    // ─── Profit Report (by Route) ────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ProfitRouteRow {
        private UUID routeId;
        private String routeName;
        private int orderCount;
        private BigDecimal revenue;
        private BigDecimal cogs;
        private BigDecimal grossProfit;
        private BigDecimal marginPercent;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ProfitReportResponse {
        private LocalDate from;
        private LocalDate to;
        private int totalOrders;
        private BigDecimal totalRevenue;
        private BigDecimal totalCogs;
        private BigDecimal totalGrossProfit;
        private BigDecimal totalMarginPercent;
        private List<ProfitRouteRow> routeBreakdown;
    }

    // ─── Brand Profit Report ─────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BrandProfitRow {
        private String brand;
        private int qtySold;
        private int orderCount;
        private BigDecimal revenue;
        private BigDecimal cogs;
        private BigDecimal grossProfit;
        private BigDecimal marginPercent;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BrandProfitResponse {
        private LocalDate from;
        private LocalDate to;
        private int totalOrders;
        private BigDecimal totalRevenue;
        private BigDecimal totalCogs;
        private BigDecimal totalGrossProfit;
        private BigDecimal totalMarginPercent;
        private List<BrandProfitRow> brands;
    }
}
