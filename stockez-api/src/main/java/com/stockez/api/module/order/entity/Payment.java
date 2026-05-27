package com.stockez.api.module.order.entity;

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

/**
 * Payment collection by sales person or delivery person.
 * Accountant verifies and clears daily.
 */
@Entity
@Table(name = "payments",
    indexes = {
        @Index(name = "idx_payment_tenant", columnList = "tenant_id"),
        @Index(name = "idx_payment_order", columnList = "order_id"),
        @Index(name = "idx_payment_collector", columnList = "collected_by_id"),
        @Index(name = "idx_payment_date", columnList = "collection_date"),
        @Index(name = "idx_payment_cleared", columnList = "cleared")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "collected_by_id", nullable = false)
    private User collectedBy; // sales or delivery person

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by_id")
    private User verifiedBy; // accountant

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentMode paymentMode;

    @Column(length = 100)
    private String paymentMethodName; // display name from payment_methods table (e.g. "GPay", "PhonePe")

    @Column(length = 200)
    private String referenceNumber; // UPI txn id, cheque number etc.

    @Column(nullable = false)
    private LocalDate collectionDate;

    @Builder.Default
    private boolean cleared = false; // Accountant marked cleared

    private Instant clearedAt;

    @Builder.Default
    private boolean submitted = false; // Person submitted day collections to accountant

    private Instant submittedAt;

    @Column(length = 500)
    private String notes;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public enum PaymentMode {
        CASH, UPI, CHEQUE, NEFT, RTGS, CREDIT
    }
}
