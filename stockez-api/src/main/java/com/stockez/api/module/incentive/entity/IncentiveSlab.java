package com.stockez.api.module.incentive.entity;

import com.stockez.api.module.product.entity.ProductMaster;
import com.stockez.api.module.tenant.entity.Tenant;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "incentive_slabs",
    uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "brand_id", "from_pct"}))
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IncentiveSlab {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "brand_id", nullable = false)
    private ProductMaster brandMaster;

    @Column(nullable = false, length = 200)
    private String brand; // snapshot of brandMaster.name

    @Column(name = "from_pct", nullable = false)
    private Integer fromPct;

    @Column(name = "to_pct")
    private Integer toPct;

    @Column(name = "incentive_amount", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal incentiveAmount = BigDecimal.ZERO;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
