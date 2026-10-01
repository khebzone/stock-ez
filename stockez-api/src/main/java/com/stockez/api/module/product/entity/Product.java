package com.stockez.api.module.product.entity;

import com.stockez.api.module.tenant.entity.Tenant;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "products",
    indexes = {
        @Index(name = "idx_products_tenant",      columnList = "tenant_id"),
        @Index(name = "idx_products_brand_id",    columnList = "brand_id"),
        @Index(name = "idx_products_category_id", columnList = "category_id"),
        @Index(name = "idx_products_active",      columnList = "active")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 50)
    private String hsnCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_id")
    private ProductMaster brandMaster;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private ProductMaster categoryMaster;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sub_category_id")
    private ProductMaster subCategoryMaster;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id")
    private ProductMaster unitMaster;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal mrp;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal purchaseRate;

    @Column(precision = 10, scale = 2)
    private BigDecimal minSaleRate;

    @Column(precision = 10, scale = 2)
    private BigDecimal maxSaleRate;

    @Column(nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal purchaseGstPercent = BigDecimal.ZERO;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal salesGstPercent;

    @Column(precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal cgstPercent = BigDecimal.ZERO;

    @Column(precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal sgstPercent = BigDecimal.ZERO;

    @Column(length = 500)
    private String imageUrl;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Builder.Default
    private Integer stockQuantity = 0;

    @Column
    private java.time.LocalDate mfgDate;

    @Column
    private java.time.LocalDate expiryDate;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    // Convenience accessors — all callers (reports, orders, PDF) use these and stay unchanged
    public String getBrand() { return brandMaster != null ? brandMaster.getName() : null; }
    public String getCategory() { return categoryMaster != null ? categoryMaster.getName() : null; }
    public String getSubCategory() { return subCategoryMaster != null ? subCategoryMaster.getName() : null; }
    public String getUnit() { return unitMaster != null ? unitMaster.getName() : null; }

    public UUID getBrandId() { return brandMaster != null ? brandMaster.getId() : null; }
    public UUID getCategoryId() { return categoryMaster != null ? categoryMaster.getId() : null; }
    public UUID getSubCategoryId() { return subCategoryMaster != null ? subCategoryMaster.getId() : null; }
    public UUID getUnitId() { return unitMaster != null ? unitMaster.getId() : null; }
}
