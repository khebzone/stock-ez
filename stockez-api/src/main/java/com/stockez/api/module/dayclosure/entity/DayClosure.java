package com.stockez.api.module.dayclosure.entity;

import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "day_closures",
    uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "closure_date"}),
    indexes = @Index(name = "idx_day_closure_tenant_date", columnList = "tenant_id, closure_date")
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DayClosure {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(name = "closure_date", nullable = false)
    private LocalDate closureDate;

    @Builder.Default
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal openingCash = BigDecimal.ZERO;      // carry-forward from previous day

    @Builder.Default
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalCash = BigDecimal.ZERO;

    @Builder.Default
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalUpi = BigDecimal.ZERO;

    @Builder.Default
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalCheque = BigDecimal.ZERO;

    @Builder.Default
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalNeft = BigDecimal.ZERO;         // NEFT + RTGS

    @Builder.Default
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalCollected = BigDecimal.ZERO;    // all modes

    @Builder.Default
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal expectedCashClosing = BigDecimal.ZERO; // openingCash + totalCash

    @Builder.Default
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal physicalCashEntered = BigDecimal.ZERO; // what accountant counted

    @Builder.Default
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal difference = BigDecimal.ZERO;         // physical - expected

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 10)
    private Status status = Status.CLOSED;

    @Column(length = 500)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by_id")
    private User closedByUser;

    private Instant closedAt;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public enum Status { OPEN, CLOSED }
}
