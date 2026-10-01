package com.stockez.api.module.product.dto;

import jakarta.validation.constraints.*;
import jakarta.validation.constraints.Min;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class ProductDtos {

    @Data
    public static class CreateProductRequest {
        @NotBlank(message = "Product name is required")
        @Size(max = 200)
        private String name;

        @Size(max = 50)
        private String hsnCode;

        @NotNull(message = "Brand is required")       private UUID brandId;
        @NotNull(message = "Category is required")    private UUID categoryId;
        @NotNull(message = "Sub Category is required") private UUID subCategoryId;
        @NotNull(message = "Unit is required")        private UUID unitId;

        @NotNull @DecimalMin("0.01")
        private BigDecimal mrp;

        @NotNull @DecimalMin("0.01")
        private BigDecimal purchaseRate;

        @DecimalMin("0.01")
        private BigDecimal minSaleRate;

        @DecimalMin("0.01")
        private BigDecimal maxSaleRate;

        @DecimalMin("0") @DecimalMax("100")
        private BigDecimal purchaseGstPercent;

        @NotNull
        @DecimalMin("0") @DecimalMax("100")
        private BigDecimal salesGstPercent;

        @Size(max = 1000)
        private String description;

        @Size(max = 500)
        private String imageUrl;

        @Min(0)
        private Integer stockQuantity;

        private java.time.LocalDate mfgDate;
        private java.time.LocalDate expiryDate;
    }

    @Data
    public static class UpdateProductRequest {
        @NotBlank @Size(max = 200)
        private String name;

        @Size(max = 50) private String hsnCode;

        @NotNull(message = "Brand is required")       private UUID brandId;
        @NotNull(message = "Category is required")    private UUID categoryId;
        @NotNull(message = "Sub Category is required") private UUID subCategoryId;
        @NotNull(message = "Unit is required")        private UUID unitId;

        @NotNull @DecimalMin("0.01") private BigDecimal mrp;
        @NotNull @DecimalMin("0.01") private BigDecimal purchaseRate;
        @DecimalMin("0.01") private BigDecimal minSaleRate;
        @DecimalMin("0.01") private BigDecimal maxSaleRate;
        @DecimalMin("0") @DecimalMax("100") private BigDecimal purchaseGstPercent;
        @NotNull @DecimalMin("0") @DecimalMax("100") private BigDecimal salesGstPercent;
        @Size(max = 1000) private String description;
        @Size(max = 500) private String imageUrl;
        @Min(0) private Integer stockQuantity;
        private boolean active;
        private java.time.LocalDate mfgDate;
        private java.time.LocalDate expiryDate;
    }

    @Data
    public static class ProductResponse {
        private UUID id;
        private String name;
        private String hsnCode;
        // String names for display (reports, orders, PDF stay unchanged)
        private String brand;
        private String category;
        private String subCategory;
        private String unit;
        // UUIDs for form pre-population on edit
        private UUID brandId;
        private UUID categoryId;
        private UUID subCategoryId;
        private UUID unitId;
        private BigDecimal mrp;
        private BigDecimal purchaseRate;
        private BigDecimal minSaleRate;
        private BigDecimal maxSaleRate;
        private BigDecimal fifoMrp;
        private BigDecimal fifoMinSaleRate;
        private BigDecimal fifoMaxSaleRate;
        private Integer fifoBatchAvailable;
        private BigDecimal fifoPurchaseRate;
        private BigDecimal fifoPurchaseGstPercent;
        private BigDecimal purchaseGstPercent;
        private BigDecimal salesGstPercent;
        private BigDecimal cgstPercent;
        private BigDecimal sgstPercent;
        private String imageUrl;
        private String description;
        private boolean active;
        private Integer stockQuantity;
        private Instant createdAt;
        private java.time.LocalDate mfgDate;
        private java.time.LocalDate expiryDate;
    }

    @Data
    public static class ProductSummary {
        private UUID id;
        private String name;
        private String brand;
        private String unit;
        private BigDecimal minSaleRate;
        private BigDecimal maxSaleRate;
        private BigDecimal salesGstPercent;
        private String imageUrl;
        private Integer stockQuantity;
    }
}
