package com.distroiq.api.module.product.dto;

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

        @Size(max = 100)
        private String brand;

        @Size(max = 100)
        private String category;

        @Size(max = 100)
        private String subCategory;

        @NotBlank(message = "Unit is required")
        @Size(max = 20)
        private String unit;

        @NotNull @DecimalMin("0.01")
        private BigDecimal mrp;

        @NotNull @DecimalMin("0.01")
        private BigDecimal purchaseRate;

        @NotNull @DecimalMin("0.01")
        private BigDecimal salesRate1;

        private BigDecimal salesRate2;
        private BigDecimal salesRate3;

        /** Floor rate — salesperson cannot bill below this */
        @DecimalMin("0.01")
        private BigDecimal minSaleRate;

        /** Ceiling rate — salesperson cannot bill above this */
        @DecimalMin("0.01")
        private BigDecimal maxSaleRate;

        @DecimalMin("0") @DecimalMax("28")
        private BigDecimal purchaseGstPercent;

        @NotNull
        @DecimalMin("0") @DecimalMax("28")
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
        @Size(max = 50)  private String hsnCode;
        @Size(max = 100) private String brand;
        @Size(max = 100) private String category;
        @Size(max = 100) private String subCategory;
        @NotBlank @Size(max = 20) private String unit;
        @NotNull @DecimalMin("0.01") private BigDecimal mrp;
        @NotNull @DecimalMin("0.01") private BigDecimal purchaseRate;
        @NotNull @DecimalMin("0.01") private BigDecimal salesRate1;
        private BigDecimal salesRate2;
        private BigDecimal salesRate3;
        @DecimalMin("0.01") private BigDecimal minSaleRate;
        @DecimalMin("0.01") private BigDecimal maxSaleRate;
        @DecimalMin("0") @DecimalMax("28") private BigDecimal purchaseGstPercent;
        @NotNull @DecimalMin("0") @DecimalMax("28") private BigDecimal salesGstPercent;
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
        private String brand;
        private String category;
        private String subCategory;
        private String unit;
        private BigDecimal mrp;
        private BigDecimal purchaseRate;
        private BigDecimal salesRate1;
        private BigDecimal salesRate2;
        private BigDecimal salesRate3;
        private BigDecimal minSaleRate;
        private BigDecimal maxSaleRate;
        private BigDecimal fifoMinSaleRate;
        private BigDecimal fifoMaxSaleRate;
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
        private BigDecimal salesRate1;
        private BigDecimal minSaleRate;
        private BigDecimal maxSaleRate;
        private BigDecimal salesGstPercent;
        private String imageUrl;
        private Integer stockQuantity;
    }
}
