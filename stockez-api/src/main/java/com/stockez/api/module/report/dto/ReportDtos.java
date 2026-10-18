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
        private BigDecimal bucket0to7;
        private BigDecimal bucket8to15;
        private BigDecimal bucket16to30;
        private BigDecimal bucket31to45;
        private BigDecimal bucket46to60;
        private BigDecimal bucket60plus;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AgingSummary {
        private BigDecimal totalOutstanding;
        private BigDecimal bucket0to7;
        private BigDecimal bucket8to15;
        private BigDecimal bucket16to30;
        private BigDecimal bucket31to45;
        private BigDecimal bucket46to60;
        private BigDecimal bucket60plus;
        private int customerCount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AgingReportResponse {
        private List<AgingRow> rows;
        private AgingSummary summary;
    }

    // ─── Daily Report ────────────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailySummary {
        private int totalOrders;
        private BigDecimal totalInvoiced;
        private BigDecimal totalCollected;
        private BigDecimal totalRefunds;
        private BigDecimal totalOutstanding;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyOrderRow {
        private UUID orderId;
        private String orderNumber;
        private String customerName;
        private String status;
        private BigDecimal totalAmount;
        private BigDecimal paidAmount;
        private BigDecimal balanceAmount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailySalesGroup {
        private UUID salespersonId;
        private String salespersonName;
        private UUID routeId;
        private String routeName;
        private int orderCount;
        private BigDecimal totalInvoiced;
        private BigDecimal totalCollected;
        private BigDecimal balance;
        private List<DailyOrderRow> orders;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyPaymentRow {
        private String orderNumber;
        private String customerName;
        private String paymentMode;
        private String paymentMethodName;
        private BigDecimal amount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyCollectionGroup {
        private UUID collectorId;
        private String collectorName;
        private BigDecimal cashTotal;
        private BigDecimal digitalTotal;
        private BigDecimal total;
        private List<DailyPaymentRow> payments;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyRefundRow {
        private String orderNumber;
        private String customerName;
        private String processedByName;
        private String paymentMode;
        private BigDecimal amount; // positive magnitude of the cash paid back out
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyDeliveryRow {
        private UUID orderId;
        private String orderNumber;
        private String customerName;
        private String status;
        private BigDecimal totalAmount;
        private BigDecimal paidAmount;
        private BigDecimal balanceAmount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyDeliveryGroup {
        private UUID deliveryPersonId;
        private String deliveryPersonName;
        private UUID routeId;
        private String routeName;
        private int orderCount;
        private int deliveredCount;
        private int dispatchedCount;
        private BigDecimal totalAmount;
        private BigDecimal totalCollected;
        private List<DailyDeliveryRow> orders;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DailyReportResponse {
        private LocalDate date;
        private DailySummary summary;
        private List<DailySalesGroup> sales;
        private List<DailyCollectionGroup> collections;
        private List<DailyRefundRow> refunds;
        private List<DailyDeliveryGroup> deliveries;
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
        private BigDecimal creditAmount;
        private BigDecimal totalAmount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CollectionReportResponse {
        private List<DailyCollection> dailyBreakdown;
        private BigDecimal totalCollected;
        private BigDecimal totalCash;
        private BigDecimal totalDigital;
        private BigDecimal totalCredit;
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
    public static class CustomerHistoryRow {
        private Integer serialNo;
        private String billNo;            // null on continuation (extra collection) rows
        private LocalDate billDate;       // null on continuation rows
        private BigDecimal billAmount;    // null on continuation rows
        private LocalDate collectionDate; // null when the bill has no collection yet
        private BigDecimal collectionAmount;
        private String collectedBy;
        private String paymentMode;       // "Cash", "GPay", "Cheque"…
        private BigDecimal dueAmount;     // running balance on this bill after this row
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CustomerHistoryResponse {
        private UUID customerId;
        private String businessName;
        private String phone;
        private LocalDate from;
        private LocalDate to;
        private BigDecimal openingBalance;
        private BigDecimal totalBilled;
        private BigDecimal totalCollected;
        private BigDecimal closingBalance;
        private List<CustomerHistoryRow> rows;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SupplierHistoryRow {
        private Integer serialNo;
        private String billNo;            // entry no / "Opening Balance" / "On-Account Payments" / "Goods Returned"; null on continuation
        private String invoiceNo;         // supplier's invoice number; null on continuation / on-account
        private LocalDate billDate;       // null on continuation rows
        private BigDecimal billAmount;    // null on continuation rows
        private LocalDate paymentDate;    // null when the bill has no payment yet
        private BigDecimal paymentAmount;
        private String paymentMethod;     // "Cash", "NEFT", "Cheque"…
        private BigDecimal dueAmount;     // running balance on this bill; null for on-account rows
        private String returnNo;          // PRN-… on a goods-returned row
        private LocalDate returnDate;
        private BigDecimal returnAmount;  // debit note value — reduces what we owe
        private String settlementMode;    // null while open; CASH_REFUND / ADJUST_AGAINST_BILL / GOODS_REPLACED
        private boolean reducesPayable;   // false once the value came back as cash or goods
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SupplierHistoryResponse {
        private String supplierName;
        private LocalDate from;
        private LocalDate to;
        private BigDecimal openingBalance;
        private BigDecimal totalPurchased;
        private BigDecimal totalPaid;
        private BigDecimal totalReturned;      // all goods sent back in the period
        private BigDecimal returnCreditOpen;   // of that, still knocked off the closing balance
        private BigDecimal closingBalance;
        private List<SupplierHistoryRow> rows;
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

    // ─── Closing Stock Report ────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ClosingStockRow {
        private UUID productId;
        private String productName;
        private String brand;
        private String category;
        private String subCategory;
        private String unit;
        private String hsnCode;
        private Integer stockQty;
        private BigDecimal purchaseRateExclGst;
        private BigDecimal purchaseRateInclGst;
        private BigDecimal stockValue;
        private BigDecimal stockValueInclGst;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ClosingStockResponse {
        private List<ClosingStockRow> rows;
        private int totalProducts;
        private int outOfStockCount;
        private int lowStockCount;
        private BigDecimal totalStockValue;
        private BigDecimal totalStockValueInclGst;
    }

    // ─── Dead Stock ──────────────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DeadStockItem {
        private UUID productId;
        private String productName;
        private String brand;
        private String category;
        private String unit;
        private int stockQty;
        private LocalDate lastBilledDate;
        private LocalDate firstReceivedDate;
        private int daysIdle;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SalesmanDeadStockItem {
        private UUID salesPersonId;
        private String salesPersonName;
        private UUID productId;
        private String productName;
        private String brand;
        private String category;
        private String unit;
        private int stockQty;
        private LocalDate lastBilledDate;
        private LocalDate firstReceivedDate;
        private int daysIdle;
    }

    // ─── Collection Detail ───────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CollectionDetailRow {
        private int sNo;
        private LocalDate collectionDate;
        private String customerName;
        private String orderNumber;
        private String paymentMode;
        private String paymentMethodName;
        private String referenceNumber;
        private BigDecimal amount;
        private String collectedBy;
        private boolean cleared;
    }

    // ─── Purchase Register (GST Audit) ──────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PurchaseRegisterRow {
        private int sNo;
        private String purchaseNo;
        private String supplierInvNo;
        private LocalDate purchaseDate;
        private String supplierName;
        private String supplierGstin;
        private String productName;
        private String unit;
        private String hsnCode;
        private BigDecimal gstPercent;
        private BigDecimal gstAmount;
        private BigDecimal cgstPercent;
        private BigDecimal cgstAmount;
        private BigDecimal sgstPercent;
        private BigDecimal sgstAmount;
        private int quantity;
        private BigDecimal rateExclGst;
        private BigDecimal netAmount;
    }

    // ─── Sales Register (GST Audit) ──────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SalesRegisterRow {
        private int sNo;
        private String invNo;
        private LocalDate invDate;
        private String customerName;
        private String gstin;
        private String productName;
        private String unit;
        private String hsnCode;
        private BigDecimal gstPercent;
        private BigDecimal gstAmount;
        private BigDecimal cgstPercent;
        private BigDecimal cgstAmount;
        private BigDecimal sgstPercent;
        private BigDecimal sgstAmount;
        private int quantity;
        private BigDecimal unitPrice;
        private BigDecimal netAmount;
    }

    // ─── Shortage / Loss Report ───────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ShortageRow {
        private LocalDate shortageDate;
        private String sourceType;       // SALES_RETURN | UNDELIVERED_ORDER
        private String referenceNumber;  // RTN-... or ORD-...
        private String productName;
        private String brand;
        private String batchNumber;
        private int quantityShort;
        private BigDecimal unitRate;
        private BigDecimal lossValue;
        private String routeName;
        private String responsiblePersonName;
        private String verifiedByName;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ShortageGroupRow {
        private String name;
        private int occurrences;
        private int quantityShort;
        private BigDecimal lossValue;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ShortageReportResponse {
        private LocalDate from;
        private LocalDate to;
        private int totalOccurrences;
        private int totalQuantityShort;
        private BigDecimal totalLossValue;
        private List<ShortageRow> rows;
        private List<ShortageGroupRow> byRoute;
        private List<ShortageGroupRow> byPerson;
    }

    // ─── Customer Sales (sales totals per customer) ──────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CustomerSalesRow {
        private UUID customerId;
        private String customerName;
        private String routeName;
        private int orderCount;
        private int totalQty;
        private BigDecimal totalAmount;
        private BigDecimal outstanding;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CustomerSalesResponse {
        private LocalDate from;
        private LocalDate to;
        private List<CustomerSalesRow> rows;
        private int customerCount;
        private int totalOrders;
        private int totalQty;
        private BigDecimal totalAmount;
        private BigDecimal totalOutstanding;
    }

    // ─── Item movement rows (shared by Customer-Item & Route-Item) ───────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ItemMovementRow {
        private UUID productId;
        private String productName;
        private String brand;
        private String unit;
        private int qty;
        private BigDecimal amount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CustomerItemResponse {
        private UUID customerId;
        private String customerName;
        private String routeName;
        private LocalDate from;
        private LocalDate to;
        private List<ItemMovementRow> rows;
        private int totalQty;
        private BigDecimal totalAmount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RouteItemResponse {
        private UUID routeId;      // null = all routes
        private String routeName;  // "All Routes" when routeId is null
        private LocalDate from;
        private LocalDate to;
        private List<ItemMovementRow> rows;
        private int totalQty;
        private BigDecimal totalAmount;
    }

    // ─── Item History (who bought a product, one row per order) ─────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ItemHistoryRow {
        private UUID orderId;
        private String orderNumber;
        private LocalDate orderDate;
        private UUID customerId;
        private String customerName;
        private int quantity;
        private BigDecimal rate;
        private BigDecimal amount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ItemHistoryResponse {
        private UUID productId;
        private String productName;
        private String brand;
        private String unit;
        private UUID customerId;     // set only when filtered to one customer
        private String customerName; // "All Customers" when not filtered
        private LocalDate from;
        private LocalDate to;
        private List<ItemHistoryRow> rows;
        private int totalQty;
        private BigDecimal totalAmount;
        private int distinctCustomers;
    }

    // ─── Route Outstanding (dues grouped by route) ───────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RouteOutstandingRow {
        private UUID routeId;
        private String routeName;
        private int customerCount;
        private BigDecimal outstanding;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RouteOutstandingResponse {
        private LocalDate asOfDate;
        private List<RouteOutstandingRow> rows;
        private int routeCount;
        private int customerCount;
        private BigDecimal totalOutstanding;
    }

    // ─── GSTR-1 (monthly outward supplies return) ────────────────────────────
    // Sales split the way the GST portal wants them: registered buyers invoice-by-invoice
    // (so they can claim input credit), unregistered buyers as one consolidated figure per
    // rate, plus the mandatory HSN summary and credit notes for goods that came back.

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Gstr1Response {
        private LocalDate from;
        private LocalDate to;
        private String companyGstin;
        private String companyStateCode;
        private int invoiceCount;
        private int b2bInvoiceCount;
        private int b2cInvoiceCount;
        private Gstr1Totals totals;
        private List<Gstr1B2bRow> b2b;          // Table 4 — one row per invoice per tax rate
        private List<Gstr1B2csRow> b2cs;        // Table 7 — consolidated per rate
        private List<Gstr1HsnRow> hsn;          // Table 12 — mandatory HSN summary
        private List<Gstr1CreditNoteRow> creditNotes; // Table 9B — sales returns
        private Gstr1DataQuality dataQuality;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Gstr1Totals {
        private BigDecimal taxableValue;
        private BigDecimal cgst;
        private BigDecimal sgst;
        private BigDecimal totalTax;
        private BigDecimal roundOff;
        private BigDecimal invoiceValue;
        private BigDecimal b2bTaxableValue;
        private BigDecimal b2cTaxableValue;
        private BigDecimal creditNoteTaxableValue;
        private BigDecimal netTaxableValue;   // taxable less credit notes — what the liability is on
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Gstr1B2bRow {
        private String gstin;
        private String customerName;
        private String invoiceNo;
        private LocalDate invoiceDate;
        private BigDecimal invoiceValue;      // whole-invoice total, repeated on each rate row
        private String placeOfSupply;         // state code, taken from the buyer's own GSTIN
        private String reverseCharge;         // always "N" for ordinary distribution sales
        private BigDecimal rate;
        private BigDecimal taxableValue;
        private BigDecimal cgst;
        private BigDecimal sgst;
        private boolean interState;           // buyer's state ≠ ours — the split needs review
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Gstr1B2csRow {
        private String type;                  // "OE" — over the counter, not through an e-commerce operator
        private String placeOfSupply;
        private BigDecimal rate;
        private BigDecimal taxableValue;
        private BigDecimal cgst;
        private BigDecimal sgst;
        private int invoiceCount;             // not filed, but lets him tie the figure back to bills
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Gstr1HsnRow {
        private String hsnCode;
        private String description;
        private String uqc;                   // unit of measure
        private BigDecimal totalQuantity;
        private BigDecimal rate;
        private BigDecimal taxableValue;
        private BigDecimal cgst;
        private BigDecimal sgst;
        private BigDecimal totalValue;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Gstr1CreditNoteRow {
        private String noteNo;
        private LocalDate noteDate;
        private String gstin;                 // null when the return was from an unregistered shop
        private String customerName;
        private String originalInvoiceNo;
        private LocalDate originalInvoiceDate;
        private BigDecimal rate;
        private BigDecimal taxableValue;
        private BigDecimal cgst;
        private BigDecimal sgst;
        private BigDecimal noteValue;
        private boolean registeredBuyer;      // only these go in invoice-wise; rest net off B2C
    }

    /** Everything that would make the filed return wrong, listed so it can be fixed first. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Gstr1DataQuality {
        private boolean companyGstinMissing;
        private boolean companyStateCodeMissing;
        private List<Gstr1Problem> problems;
        private int problemCount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Gstr1Problem {
        private String kind;      // MALFORMED_GSTIN | MISSING_HSN | INTER_STATE_B2B | INVOICED_NOT_DELIVERED
        private String subject;   // the customer, product, or invoice it concerns
        private String detail;
        private BigDecimal amountAffected;
    }
}
