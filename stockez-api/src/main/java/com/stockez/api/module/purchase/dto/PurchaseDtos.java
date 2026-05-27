package com.stockez.api.module.purchase.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class PurchaseDtos {

    @Data
    public static class CreatePurchaseRequest {
        private UUID supplierId;

        @NotBlank(message = "Supplier name is required")
        @Size(max = 200)
        private String supplierName;

        @NotNull(message = "Purchase date is required")
        private LocalDate purchaseDate;

        @Size(max = 50)
        private String invoiceNumber;

        @Size(max = 1000)
        private String notes;

        @NotEmpty(message = "At least one product is required")
        @Valid
        private List<PurchaseItemRequest> items;
    }

    @Data
    public static class PurchaseItemRequest {
        @NotNull(message = "Product is required")
        private UUID productId;

        @NotNull(message = "Total amount is required")
        @DecimalMin(value = "0.01", message = "Total amount must be greater than 0")
        private BigDecimal totalAmount;

        @DecimalMin(value = "0")
        private BigDecimal discountAmount;

        @NotNull(message = "MRP is required")
        @DecimalMin(value = "0.01", message = "MRP must be greater than 0")
        private BigDecimal mrp;

        private LocalDate mfgDate;

        private LocalDate expiryDate;

        @NotNull(message = "Quantity is required")
        @Min(value = 1, message = "Quantity must be at least 1")
        private Integer quantity;

        @DecimalMin(value = "0")
        private BigDecimal minSaleRate;

        @DecimalMin(value = "0")
        private BigDecimal maxSaleRate;
    }

    @Data
    public static class BatchItemUpdate {
        private UUID itemId;
        private BigDecimal mrp;
        private LocalDate expiryDate;
        private LocalDate mfgDate;
        private BigDecimal minSaleRate;
        private BigDecimal maxSaleRate;
    }

    @Data
    public static class UpdatePurchaseRequest {
        private UUID supplierId;

        @NotBlank(message = "Supplier name is required")
        @Size(max = 200)
        private String supplierName;

        @NotNull(message = "Purchase date is required")
        private LocalDate purchaseDate;

        @Size(max = 50)
        private String invoiceNumber;

        @Size(max = 1000)
        private String notes;

        private List<BatchItemUpdate> itemUpdates;
    }

    // Responses
    @Data
    public static class PurchaseEntryResponse {
        private UUID id;
        private String entryNumber;
        private UUID supplierId;
        private String supplierName;
        private LocalDate purchaseDate;
        private String invoiceNumber;
        private BigDecimal totalAmount;
        private BigDecimal totalTaxable;
        private BigDecimal totalCgst;
        private BigDecimal totalSgst;
        private String notes;
        private PersonInfo createdBy;
        private List<PurchaseItemResponse> items;
        private Instant createdAt;
    }

    @Data
    public static class PurchaseItemResponse {
        private UUID id;
        private ProductInfo product;
        private String batchNumber;
        private BigDecimal mrp;
        private BigDecimal discountAmount;
        private BigDecimal taxableAmount;
        private BigDecimal gstPercent;
        private BigDecimal cgstPercent;
        private BigDecimal sgstPercent;
        private BigDecimal cgstAmount;
        private BigDecimal sgstAmount;
        private BigDecimal gstAmount;
        private BigDecimal purchaseRate;
        private LocalDate mfgDate;
        private LocalDate expiryDate;
        private Integer quantity;
        private BigDecimal amount;
        private BigDecimal minSaleRate;
        private BigDecimal maxSaleRate;
    }

    @Data
    public static class StockBatchResponse {
        private UUID id;
        private ProductInfo product;
        private String batchNumber;
        private BigDecimal mrp;
        private BigDecimal purchaseRate;
        private BigDecimal minSaleRate;
        private BigDecimal maxSaleRate;
        private LocalDate mfgDate;
        private LocalDate expiryDate;
        private Integer quantityReceived;
        private Integer quantityAvailable;
        private LocalDate receivedDate;
        private boolean active;
        private boolean nearExpiry;
        private boolean expired;
        private Instant createdAt;
        private String purchaseEntryNumber;
        private UUID supplierId;
        private String supplierName;
    }

    @Data
    public static class NearExpiryAlert {
        private UUID batchId;
        private String batchNumber;
        private ProductInfo product;
        private LocalDate expiryDate;
        private int daysToExpiry;
        private Integer quantityAvailable;
    }

    @Data
    public static class ProductInfo {
        private UUID id;
        private String name;
        private String brand;
        private String unit;
        private String hsnCode;
        private String imageUrl;
    }

    @Data
    public static class PersonInfo {
        private UUID id;
        private String fullName;
    }

    @Data
    public static class AuditLogResponse {
        private UUID id;
        private String action;
        private String description;
        private String performedBy;
        private java.time.Instant performedAt;
    }
}
