package com.stockez.api.module.purchase.entity;

import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.tenant.entity.Tenant;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "stock_batches",
    indexes = {
        @Index(name = "idx_batch_tenant", columnList = "tenant_id"),
        @Index(name = "idx_batch_product", columnList = "product_id"),
        @Index(name = "idx_batch_expiry", columnList = "expiry_date"),
        @Index(name = "idx_batch_active", columnList = "active"),
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StockBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_item_id")
    private PurchaseItem purchaseItem;

    @Column(nullable = false, length = 100)
    private String batchNumber;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal mrp;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal purchaseRate;

    private LocalDate mfgDate;

    private LocalDate expiryDate;

    @Column(nullable = false)
    private Integer quantityReceived;

    @Column(nullable = false)
    @Builder.Default
    private Integer quantityAvailable = 0;

    // Per-batch selling price range (set when purchase rate differs from product baseline)
    @Column(precision = 10, scale = 2)
    private BigDecimal minSaleRate;

    @Column(precision = 10, scale = 2)
    private BigDecimal maxSaleRate;

    @Column(nullable = false)
    private LocalDate receivedDate;

    @Builder.Default
    private boolean active = true;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
