package com.stockez.api.module.tenant.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tenant_settings")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TenantSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false, unique = true)
    private Tenant tenant;

    @Builder.Default
    @Column(nullable = false)
    private boolean invoiceApprovalRequired = true;

    @Builder.Default
    @Column(nullable = false)
    private boolean picklistEnabled = true;

    @Builder.Default
    @Column(nullable = false)
    private boolean goodsReturnApprovalRequired = false;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CreditLimitEnforcement creditLimitEnforcement = CreditLimitEnforcement.HARD_BLOCK;

    @Column(precision = 5, scale = 2)
    private BigDecimal maxDiscountPercent;

    @Builder.Default
    @Column(nullable = false)
    private boolean lockBillingAfterCheckout = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean separateDeliveryAllocation = false;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private DiscountType discountType = DiscountType.PERCENT;

    @Builder.Default
    @Column(nullable = false)
    private boolean showPurchaseRateToSales = true;

    @LastModifiedDate
    private Instant updatedAt;

    public enum CreditLimitEnforcement { HARD_BLOCK, DISABLED }
    public enum DiscountType { PERCENT, AMOUNT }
}
