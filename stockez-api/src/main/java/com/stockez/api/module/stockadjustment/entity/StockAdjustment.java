package com.stockez.api.module.stockadjustment.entity;

import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "stock_adjustments",
    indexes = {
        @Index(name = "idx_stock_adj_tenant",  columnList = "tenant_id"),
        @Index(name = "idx_stock_adj_product", columnList = "tenant_id, product_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StockAdjustment {

    public enum AdjustmentType { EXCESS, SHORTAGE }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "batch_id", nullable = false)
    private StockBatch batch;

    @Column(nullable = false, length = 100)
    private String batchNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private AdjustmentType type;

    @Column(nullable = false)
    private Integer quantityAdjusted;

    @Column(nullable = false)
    private Integer quantityBefore;

    @Column(nullable = false)
    private Integer quantityAfter;

    @Column(length = 500)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_id", nullable = false)
    private User createdBy;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
