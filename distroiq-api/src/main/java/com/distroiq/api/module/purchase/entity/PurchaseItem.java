package com.distroiq.api.module.purchase.entity;

import com.distroiq.api.module.product.entity.Product;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "purchase_items",
    indexes = { @Index(name = "idx_purchaseitem_entry", columnList = "purchase_entry_id") }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PurchaseItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "purchase_entry_id", nullable = false)
    private PurchaseEntry purchaseEntry;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, length = 100)
    private String batchNumber;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal mrp;

    @Column(nullable = false, precision = 10, scale = 4)
    private BigDecimal rateExclGst;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPercent;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal discountAmount;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal taxableAmount;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal gstPercent;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal gstAmount;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal cgstPercent;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal sgstPercent;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal cgstAmount;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal sgstAmount;

    @Column(nullable = false, precision = 10, scale = 4)
    private BigDecimal purchaseRate;

    private LocalDate mfgDate;

    private LocalDate expiryDate;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
}
