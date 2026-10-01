package com.stockez.api.module.goodsreturn.entity;

import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.purchase.entity.PurchaseEntry;
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
        SALES_RETURN, PURCHASE_RETURN, DAMAGE, OLD_STOCK_RETURN
    }

    public enum RefundStatus {
        NONE, PENDING, PROCESSED
    }

    // How a supplier claim was settled. Only ADJUST_AGAINST_BILL leaves our payable reduced —
    // the other two hand the value back as cash or as goods, so the bill stands in full.
    public enum SettlementMode {
        CASH_REFUND, ADJUST_AGAINST_BILL, GOODS_REPLACED
    }

    public enum WarehouseStatus {
        PENDING_VERIFICATION, VERIFIED, CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, unique = true, length = 50)
    private String returnNumber; // SRN- (sales) / PRN- (purchase) / DMG- (damage) -YYYY-NNNNN; legacy rows may be RTN-

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReturnType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order referenceOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_entry_id")
    private PurchaseEntry referencePurchaseEntry;

    // Set only for OLD_STOCK_RETURN (legacy return with no order) — the shop the goods came back from.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private com.stockez.api.module.customer.entity.Customer customer;

    @Column(length = 200)
    private String supplierName;

    @Column(nullable = false)
    private LocalDate returnDate;

    @Column(length = 500)
    private String reason;

    // ── DAMAGE only ── where the loss originated, and who is held responsible.
    // SUPPLIER damage is treated as a recoverable claim; the rest are internal losses.
    @Column(name = "damage_source", length = 20)
    private String damageSource; // SUPPLIER / WAREHOUSE / TRANSIT / CUSTOMER

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsible_person_id")
    private User responsiblePerson;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private RefundStatus refundStatus = RefundStatus.NONE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private WarehouseStatus warehouseStatus = WarehouseStatus.VERIFIED;

    @Column(precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal refundAmount = BigDecimal.ZERO;

    private LocalDate refundDate;

    @Column(length = 20)
    private String refundMode;

    // ── Supplier claims (PURCHASE_RETURN, supplier-caused DAMAGE) ──────────────
    // Null while the claim is open. An open claim and an ADJUST_AGAINST_BILL claim both
    // reduce what we owe the supplier; see GoodsReturnRepository.sumOpenSupplierCredit*.
    @Enumerated(EnumType.STRING)
    @Column(name = "settlement_mode", length = 30)
    private SettlementMode settlementMode;

    // The supplier's own credit note / replacement invoice number, for reconciliation.
    @Column(name = "supplier_ref_number", length = 60)
    private String supplierRefNumber;

    @Column(name = "replacement_restocked", nullable = false)
    @Builder.Default
    private boolean replacementRestocked = false;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by_id")
    private User verifiedBy;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by_id")
    private User cancelledBy;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
