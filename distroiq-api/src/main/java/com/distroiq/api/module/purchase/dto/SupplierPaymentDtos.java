package com.distroiq.api.module.purchase.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public class SupplierPaymentDtos {

    @Data
    public static class CreateSupplierPaymentRequest {
        private UUID purchaseEntryId;

        @NotBlank(message = "Supplier name is required")
        private String supplierName;

        @NotNull(message = "Amount is required")
        @Positive(message = "Amount must be positive")
        private BigDecimal amount;

        @NotNull(message = "Payment date is required")
        private LocalDate paymentDate;

        @NotBlank(message = "Payment method is required")
        private String paymentMethod;

        private String referenceNumber;
        private String notes;
    }

    @Data
    @Builder
    public static class SupplierPaymentResponse {
        private UUID id;
        private UUID purchaseEntryId;
        private String purchaseEntryNumber;
        private String supplierName;
        private BigDecimal amount;
        private LocalDate paymentDate;
        private String paymentMethod;
        private String referenceNumber;
        private String notes;
        private Instant createdAt;
    }

    @Data
    @Builder
    public static class SupplierSummary {
        private String supplierName;
        private BigDecimal totalPurchased;
        private BigDecimal totalPaid;
        private BigDecimal outstanding;
        private LocalDate lastPurchaseDate;
        private LocalDate lastPaymentDate;
    }
}
