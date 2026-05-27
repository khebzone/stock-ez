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

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitRate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount; // quantity * unitRate

    @Column(length = 200)
    private String reason;
}
