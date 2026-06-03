package com.stockez.api.module.incentive.entity;

import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "collection_incentive_credits",
    uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "sales_person_id", "target_month", "target_year"}))
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CollectionIncentiveCredit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sales_person_id", nullable = false)
    private User salesPerson;

    @Column(name = "target_month", nullable = false)
    private Integer targetMonth;

    @Column(name = "target_year", nullable = false)
    private Integer targetYear;

    @Column(name = "target_value", nullable = false, precision = 14, scale = 2)
    private BigDecimal targetValue;

    @Column(name = "achieved_value", nullable = false, precision = 14, scale = 2)
    private BigDecimal achievedValue;

    @Column(name = "achievement_pct", nullable = false, precision = 6, scale = 2)
    private BigDecimal achievementPct;

    @Column(name = "incentive_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal incentiveAmount;

    @Column(length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "credited_at")
    private Instant creditedAt;

    @Column(length = 1000)
    private String notes;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
