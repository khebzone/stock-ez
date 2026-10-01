package com.stockez.api.module.goodsreturn.entity;

import com.stockez.api.module.product.entity.Product;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "goods_return_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GoodsReturnItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "goods_return_id", nullable = false)
    private GoodsReturn goodsReturn;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(length = 100)
    private String batchNumber;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "received_qty")
    private Integer receivedQty; // actual qty warehouse physically received at verification (may be < quantity)

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitRate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount; // quantity * unitRate (GST-inclusive)

    @Column(nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal gstPercent = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal taxableAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal gstAmount = BigDecimal.ZERO;

    @Column(length = 200)
    private String reason;

    // ── OLD_STOCK_RETURN only ──────────────────────────────────────────────
    // SELLABLE  → restocked into a fresh batch (uses the pricing/expiry below)
    // EXPIRED   → written off (no stock movement)
    @Column(name = "item_condition", length = 20)
    private String itemCondition;

    @Column(precision = 10, scale = 2)
    private BigDecimal mrp;

    @Column(name = "min_sale_rate", precision = 10, scale = 2)
    private BigDecimal minSaleRate;

    @Column(name = "max_sale_rate", precision = 10, scale = 2)
    private BigDecimal maxSaleRate;

    @Column(name = "purchase_rate", precision = 10, scale = 2)
    private BigDecimal purchaseRate;

    @Column(name = "expiry_date")
    private java.time.LocalDate expiryDate;
}
