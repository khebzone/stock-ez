package com.stockez.api.module.purchase.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public class PurchaseDraftDtos {

    @Data
    public static class SaveDraftRequest {
        @Size(max = 200)
        private String supplierName;

        @Size(max = 50)
        private String invoiceNumber;

        private LocalDate purchaseDate;

        @Min(0)
        private Integer lineCount;

        private BigDecimal totalAmount;

        @NotBlank(message = "Draft is empty")
        @Size(max = 1_000_000, message = "Draft is too large")
        private String payload;
    }

    @Data @Builder
    public static class DraftResponse {
        private UUID id;
        private String supplierName;
        private String invoiceNumber;
        private LocalDate purchaseDate;
        private int lineCount;
        private BigDecimal totalAmount;
        private String createdByName;
        private String updatedByName;
        private Instant createdAt;
        private Instant updatedAt;
        private String payload;
    }
}
