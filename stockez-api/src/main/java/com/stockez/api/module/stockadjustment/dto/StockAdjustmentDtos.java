package com.stockez.api.module.stockadjustment.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class StockAdjustmentDtos {

    @Data
    public static class AdjustRequest {
        @NotNull
        private UUID batchId;
        @NotBlank
        private String type; // EXCESS or SHORTAGE
        @NotNull
        @Min(1)
        private Integer quantity;
        private String reason;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class BatchForAdjustment {
        private UUID batchId;
        private String batchNumber;
        private UUID productId;
        private String productName;
        private BigDecimal mrp;
        private BigDecimal purchaseRate;
        private Integer currentStock;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class AdjustmentResponse {
        private UUID id;
        private String batchNumber;
        private String productName;
        private String type;
        private Integer quantityAdjusted;
        private Integer quantityBefore;
        private Integer quantityAfter;
        private String reason;
        private String adjustedBy;
        private Instant createdAt;
    }
}
