package com.stockez.api.module.goodsreturn.entity;

import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "goods_returns",
    indexes = {
        @Index(name = "idx_goods_return_tenant", columnList = "tenant_id, return_date DESC")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GoodsReturn {

    public enum ReturnType {
        SALES_RETURN, PURCHASE_RETURN, DAMAGE
    }

    public enum RefundStatus {
        NONE, PENDING, PROCESSED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, unique = true, length = 50)
    private String returnNumber; // RTN-YYYY-NNNNN

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReturnType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order referenceOrder;

    @Column(length = 200)
    private String supplierName;

    @Column(nullable = false)
    private LocalDate returnDate;

    @Column(length = 500)
    private String reason;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private RefundStatus refundStatus = RefundStatus.NONE;

    @Column(precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal refundAmount = BigDecimal.ZERO;

    private LocalDate refundDate;

    @Column(length = 20)
    private String refundMode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "refund_processed_by")
    private User refundProcessedBy;

    private Instant refundProcessedAt;

    @Column(length = 500)
    private String refundNotes;

    @OneToMany(mappedBy = "goodsReturn", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<GoodsReturnItem> items = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_id", nullable = false)
    private User createdBy;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
