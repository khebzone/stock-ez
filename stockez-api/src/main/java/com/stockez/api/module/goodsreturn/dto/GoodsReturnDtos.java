package com.stockez.api.module.goodsreturn.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class GoodsReturnDtos {

    @Data
    public static class CreateGoodsReturnRequest {

        @NotNull(message = "Return type is required")
        private String type; // "SALES_RETURN", "PURCHASE_RETURN", "DAMAGE", "OLD_STOCK_RETURN"

        private UUID orderId;

        private UUID purchaseEntryId;

        private UUID customerId; // required for OLD_STOCK_RETURN

        private String supplierName;

        // ── DAMAGE only ──
        private String damageSource;        // SUPPLIER / WAREHOUSE / TRANSIT / CUSTOMER
        private UUID responsiblePersonId;   // staff member held responsible (optional)

        @NotNull(message = "Return date is required")
        private LocalDate returnDate;

        private String reason;

        @NotEmpty(message = "At least one item is required")
        @Valid
        private List<GoodsReturnItemRequest> items;
    }

    @Data
    public static class GoodsReturnItemRequest {

        @NotNull(message = "Product is required")
        private UUID productId;

        private String batchNumber;

        @NotNull(message = "Quantity is required")
        @Min(value = 1, message = "Quantity must be at least 1")
        private Integer quantity;

        @NotNull(message = "Unit rate is required")
        private BigDecimal unitRate;

        private String reason;

        // ── OLD_STOCK_RETURN only ──
        private String condition; // "SELLABLE" | "EXPIRED"
        private BigDecimal mrp;
        private BigDecimal minSaleRate;
        private BigDecimal maxSaleRate;
        private BigDecimal purchaseRate; // cost
        private LocalDate expiryDate;
    }

    @Data
    public static class VerifyReceiptRequest {
        @NotEmpty(message = "At least one item is required")
        @Valid
        private List<VerifyReceiptItem> items;
    }

    @Data
    public static class VerifyReceiptItem {
        @NotNull(message = "Item id is required")
        private UUID itemId;

        @NotNull(message = "Received quantity is required")
        @Min(value = 0, message = "Received quantity cannot be negative")
        private Integer receivedQty;

        // Units among those received that are damaged and must not go back into saleable stock.
        @Min(value = 0, message = "Damaged quantity cannot be negative")
        private Integer damagedQty;
    }

    @Data
    public static class ProcessRefundRequest {
        // Required for customer refunds and for a CASH_REFUND settlement; ignored otherwise.
        private String paymentMode;

        @NotNull(message = "Refund date is required")
        private LocalDate refundDate;

        // ── Supplier claims only ──
        // CASH_REFUND | ADJUST_AGAINST_BILL | GOODS_REPLACED — required for a supplier claim.
        private String settlementMode;

        // Supplier's credit note or replacement invoice number.
        private String supplierRefNumber;

        // GOODS_REPLACED only — expiry read off the replacement packs.
        private LocalDate replacementExpiryDate;

        private String notes;
    }

    @Data
    public static class CancelReturnRequest {
        @NotNull(message = "A reason is required to cancel a return")
        private String reason;
    }

    @Data
    public static class GoodsReturnResponse {
        private UUID id;
        private String returnNumber;
        private String type;
        private String supplierName;
        private UUID customerId;
        private String customerName;
        private BigDecimal restockAmount;  // value of sellable goods put back to stock (OLD_STOCK_RETURN)
        private BigDecimal writeOffAmount; // value of expired goods written off (OLD_STOCK_RETURN)
        private String damageSource;         // DAMAGE only
        private String responsiblePersonName; // DAMAGE only
        private String referenceOrderNumber;
        private UUID referenceOrderId;
        private String referenceOrderCustomerName;
        private String referenceOrderRouteName;
        private UUID referencePurchaseEntryId;
        private String referencePurchaseEntryNumber;
        private String referencePurchaseSupplierName;
        private LocalDate returnDate;
        private String reason;
        private BigDecimal totalAmount;
        private String refundStatus;
        private BigDecimal refundAmount;
        private LocalDate refundDate;
        private String refundMode;
        private String refundNotes;
        private String settlementMode;        // supplier claims only
        private String supplierRefNumber;     // supplier claims only
        private boolean replacementRestocked; // GOODS_REPLACED — stock already put back
        private boolean reducesPayable;       // this credit is still knocked off the supplier balance
        private PersonInfo refundProcessedBy;
        private String warehouseStatus;
        private PersonInfo verifiedBy;
        private Instant verifiedAt;
        private PersonInfo cancelledBy;
        private Instant cancelledAt;
        private String cancellationReason;
        private Instant createdAt;
        private PersonInfo createdBy;
        private List<GoodsReturnItemResponse> items;
    }

    @Data
    public static class GoodsReturnItemResponse {
        private UUID id;
        private UUID productId;
        private String productName;
        private String productBrand;
        private String batchNumber;
        private Integer quantity;
        private Integer receivedQty;
        private Integer damagedQty;
        private BigDecimal unitRate;
        private BigDecimal amount;
        private BigDecimal gstPercent;
        private BigDecimal taxableAmount;
        private BigDecimal gstAmount;
        private String reason;
        private String condition;
        private LocalDate expiryDate;
        private BigDecimal mrp;
        private BigDecimal minSaleRate;
        private BigDecimal maxSaleRate;
    }

    @Data
    public static class PersonInfo {
        private UUID id;
        private String fullName;
    }

    /** Everything the printed debit note needs, resolved inside a transaction. */
    @Data
    public static class DebitNoteResponse {
        private UUID id;
        private String returnNumber;
        private LocalDate returnDate;
        private String type;
        private String reason;
        private String supplierName;
        private String supplierRefNumber;
        private String againstEntryNumber;
        private String againstInvoiceNumber;
        private LocalDate againstInvoiceDate;
        private String settlementMode;
        private String refundStatus;
        private LocalDate refundDate;
        private BigDecimal totalAmount;
        private BigDecimal totalTaxable;
        private BigDecimal totalGst;
        private String createdByName;
        private CompanyInfo company;
        private List<DebitNoteLine> lines;
        private List<GstSlab> gstSummary;
    }

    @Data
    public static class DebitNoteLine {
        private String productName;
        private String hsnCode;
        private String batchNumber;
        private Integer quantity;
        private String unitName;
        private BigDecimal unitRate;
        private BigDecimal taxableAmount;
        private BigDecimal gstPercent;
        private BigDecimal gstAmount;
        private BigDecimal amount;
        private String reason;
    }

    @Data
    public static class GstSlab {
        private BigDecimal gstPercent;
        private BigDecimal taxableAmount;
        private BigDecimal cgst;
        private BigDecimal sgst;
        private BigDecimal total;
    }

    @Data
    public static class CompanyInfo {
        private String name;
        private String ownerName;
        private String phone;
        private String email;
        private String address;
        private String city;
        private String state;
        private String stateCode;
        private String pinCode;
        private String gstin;
        private String fssaiNumber;
        private String logoUrl;
    }
}
