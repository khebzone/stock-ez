package com.stockez.api.module.order.entity;

import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.purchase.entity.StockBatch;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Individual line item within an Order.
 */
@Entity
@Table(name = "order_items",
    indexes = { @Index(name = "idx_orderitem_order", columnList = "order_id") }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal discountPercent = BigDecimal.ZERO;

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal gstPercent;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal gstAmount;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal lineTotal;

    @Column(precision = 10, scale = 2)
    private BigDecimal mrp;

    // Batch info (from FIFO deduction — primary batch used)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private StockBatch batch;

    @Column(length = 100)
    private String batchNumber;

    private LocalDate batchExpiryDate;

    // Warehouse verification (picking stage)
    @Builder.Default
    private boolean verified = false;

    private Integer verifiedQuantity;

    // Warehouse verification (return-to-warehouse confirm stage) — how many units
    // of this line actually reached the warehouse when the order was handed back.
    private Integer returnReceivedQuantity;
}
