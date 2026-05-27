package com.stockez.api.module.target.entity;

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

/**
 * Monthly sales target per salesperson per tenant.
 * Unique constraint: (tenant_id, user_id, month, year)
 */
@Entity
@Table(name = "sales_targets",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uq_target_tenant_user_month_year",
            columnNames = {"tenant_id", "user_id", "month", "year"}
        )
    },
    indexes = {
        @Index(name = "idx_target_tenant", columnList = "tenant_id"),
        @Index(name = "idx_target_user", columnList = "user_id"),
        @Index(name = "idx_target_month_year", columnList = "month, year")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SalesTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Integer month;

    @Column(nullable = false)
    private Integer year;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal targetAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    @Builder.Default
    private Integer targetOrders = 0;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
