package com.stockez.api.module.incentive.entity;

import com.stockez.api.module.tenant.entity.Tenant;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "collection_incentive_slabs")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CollectionIncentiveSlab {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(name = "from_pct", nullable = false)
    private Integer fromPct;

    @Column(name = "to_pct")
    private Integer toPct;

    @Column(name = "incentive_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal incentiveAmount;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
