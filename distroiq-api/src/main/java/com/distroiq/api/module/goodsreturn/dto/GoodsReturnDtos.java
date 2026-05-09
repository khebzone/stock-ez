package com.distroiq.api.module.goodsreturn.dto;

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
        private String type; // "SALES_RETURN", "PURCHASE_RETURN", "DAMAGE"

        private UUID orderId;

        private String supplierName;

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
    }

    @Data
    public static class GoodsReturnResponse {
        private UUID id;
        private String returnNumber;
        private String type;
        private String supplierName;
        private String referenceOrderNumber;
        private LocalDate returnDate;
        private String reason;
        private BigDecimal totalAmount;
        private Instant createdAt;
        private PersonInfo createdBy;
        private List<GoodsReturnItemResponse> items;
    }

    @Data
    public static class GoodsReturnItemResponse {
        private UUID id;
        private String productName;
        private String productBrand;
        private String batchNumber;
        private Integer quantity;
        private BigDecimal unitRate;
        private BigDecimal amount;
        private String reason;
    }

    @Data
    public static class PersonInfo {
        private UUID id;
        private String fullName;
    }
}
