package com.distroiq.api.module.goodsreturn.entity;

import com.distroiq.api.module.order.entity.Order;
import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.user.entity.User;
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
