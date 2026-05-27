package com.stockez.api.module.order.entity;

import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Sales Order — lifecycle: DRAFT → SUBMITTED → APPROVED → PREPARED → DISPATCHED → DELIVERED
 */
@Entity
@Table(name = "orders",
    indexes = {
        @Index(name = "idx_order_tenant", columnList = "tenant_id"),
        @Index(name = "idx_order_status", columnList = "status"),
        @Index(name = "idx_order_customer", columnList = "customer_id"),
        @Index(name = "idx_order_date", columnList = "order_date"),
        @Index(name = "idx_order_sales_person", columnList = "sales_person_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, unique = true, length = 50)
    private String orderNumber; // e.g., ORD-2025-00001

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "customer_id", nullable = true)
    private Customer customer;

    @Column(name = "walk_in_name", length = 200)
    private String walkInName;

    @Column(name = "walk_in_phone", length = 20)
    private String walkInPhone;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sales_person_id", nullable = false)
    private User salesPerson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delivery_person_id")
    private User deliveryPerson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    private User approvedBy;

    @Column(nullable = false)
    private LocalDate orderDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private OrderStatus status = OrderStatus.DRAFT;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 30)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    // Financials
    @Builder.Default
    private BigDecimal subTotal = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal totalGst = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal balanceAmount = BigDecimal.ZERO;

    @Column(length = 1000)
    private String notes;

    private Instant approvedAt;
    private Instant preparedAt;
    private Instant dispatchedAt;
    private Instant deliveredAt;

    // Invoice PDF URL (stored in S3)
    @Column(length = 500)
    private String invoiceUrl;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public enum OrderStatus {
        DRAFT,       // Sales person is creating the order
        SUBMITTED,   // Sales person submitted — waiting for invoice person
        APPROVED,    // Invoice person approved — bill generated
        PREPARING,   // Warehouse is picking products
        PREPARED,    // Warehouse prepared — ready for dispatch
        DISPATCHED,  // Delivery person collected
        DELIVERED,   // Delivered to customer
        CANCELLED    // Cancelled
    }
}
