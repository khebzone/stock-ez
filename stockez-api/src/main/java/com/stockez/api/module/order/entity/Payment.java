package com.stockez.api.module.order.entity;

import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
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
        @Index(name = "idx_payment_cleared", columnList = "cleared"),
        @Index(name = "idx_payment_customer", columnList = "customer_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("voided = false")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

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
    private String referenceNumber; // UPI txn id, cheque number, NEFT/RTGS UTR etc.

    @Column(nullable = false)
    private LocalDate collectionDate;

    // ── Instrument (cheque / NEFT / RTGS) realisation lifecycle ──
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private PaymentStatus status = PaymentStatus.REALISED; // CASH/UPI realised instantly; instruments start PENDING

    private LocalDate instrumentDate;  // date written on the cheque (supports post-dated)
    private LocalDate depositDate;     // date banked
    private LocalDate realisedDate;    // date money landed in bank

    @Column(length = 150)
    private String draweeBank;         // customer's bank (cheque) / remitting bank

    @Column(length = 150)
    private String depositBank;        // our bank account it was deposited into

    @Column(length = 300)
    private String bounceReason;

    @Column(precision = 14, scale = 2)
    private BigDecimal bankCharges;    // penalty the bank debited us on a bounce

    @Builder.Default
    private boolean cleared = false; // Accountant marked cleared

    private Instant clearedAt;

    @Builder.Default
    private boolean submitted = false; // Person submitted day collections to accountant

    private Instant submittedAt;

    @Column(length = 500)
    private String notes;

    @Builder.Default
    @Column(nullable = false)
    private boolean voided = false;

    private Instant voidedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voided_by_id")
    private User voidedBy;

    @Column(length = 300)
    private String voidReason;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public enum PaymentMode {
        CASH, UPI, CHEQUE, NEFT, RTGS, CREDIT
    }

    public enum PaymentStatus {
        PENDING,    // instrument received, in hand, not yet banked
        DEPOSITED,  // banked, awaiting clearance
        REALISED,   // money landed in bank — counts as collection
        BOUNCED     // returned by bank
    }

    /** Cheque / NEFT / RTGS need bank realisation; cash / UPI / credit settle at collection. */
    public boolean isInstrument() {
        return paymentMode == PaymentMode.CHEQUE
                || paymentMode == PaymentMode.NEFT
                || paymentMode == PaymentMode.RTGS;
    }
}
