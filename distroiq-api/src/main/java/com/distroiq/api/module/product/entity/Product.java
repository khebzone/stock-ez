package com.distroiq.api.module.product.entity;

import com.distroiq.api.module.tenant.entity.Tenant;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * FMCG Product entity.
 * Supports HSN code, brand, category/sub-category, multiple price tiers, GST.
 */
@Entity
@Table(name = "products",
    indexes = {
        @Index(name = "idx_product_tenant", columnList = "tenant_id"),
        @Index(name = "idx_product_category", columnList = "category"),
        @Index(name = "idx_product_brand", columnList = "brand"),
        @Index(name = "idx_product_active", columnList = "active")
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

    @Column(length = 100)
    private String brand;

    @Column(length = 100)
    private String category;

    @Column(length = 100)
    private String subCategory;

    @Column(length = 20)
    private String unit; // KG, PIECE, LITRE, BOX, CARTON

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal mrp;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal purchaseRate;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal salesRate1;

    @Column(precision = 10, scale = 2)
    private BigDecimal salesRate2;

    @Column(precision = 10, scale = 2)
    private BigDecimal salesRate3;

    /** Admin-enforced floor — salesperson cannot bill below this rate */
    @Column(precision = 10, scale = 2)
    private BigDecimal minSaleRate;

    /** Admin-enforced ceiling — salesperson cannot bill above this rate */
    @Column(precision = 10, scale = 2)
    private BigDecimal maxSaleRate;

    @Column(nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal purchaseGstPercent = BigDecimal.ZERO; // GST paid on purchase (input tax)

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal salesGstPercent; // GST charged on sales (output tax)

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

    // Stock tracking (basic)
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
}
