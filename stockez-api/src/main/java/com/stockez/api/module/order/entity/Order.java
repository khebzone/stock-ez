package com.stockez.api.module.order.entity;

import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.route.entity.RouteAllocation;
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
 * Sales Order — lifecycle: DRAFT → SUBMITTED → APPROVED → PACKING → PACKED → DISPATCHED → DELIVERED
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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sales_person_id", nullable = false)
    private User salesPerson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delivery_person_id")
    private User deliveryPerson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    private User approvedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_allocation_id")
    private RouteAllocation routeAllocation;

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

    @Column(name = "round_off_amount")
    @Builder.Default
    private BigDecimal roundOffAmount = BigDecimal.ZERO;

    // Bill-level discount: NONE / PERCENT / AMOUNT. value = what the biller typed (% or ₹),
    // amount = the ₹ actually applied before GST (apportioned across lines in the service).
    @Column(name = "overall_discount_type", length = 10)
    private String overallDiscountType;

    @Column(name = "overall_discount_value", precision = 12, scale = 2)
    private BigDecimal overallDiscountValue;

    @Column(name = "overall_discount_amount", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal overallDiscountAmount = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal balanceAmount = BigDecimal.ZERO;

    @Column(length = 1000)
    private String notes;

    @Column(name = "is_opening_balance")
    @Builder.Default
    private boolean openingBalance = false;

    private Instant approvedAt;
    private Instant packedAt;
    private Instant dispatchedAt;
    private Instant deliveredAt;
    private Instant returnedAt;

    // Invoice PDF URL (stored in S3)
    @Column(length = 500)
    private String invoiceUrl;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public enum OrderStatus {
        DRAFT,                // Sales person is creating the order
        SUBMITTED,            // Sales person submitted — waiting for invoice person
        APPROVED,             // Invoice person approved — bill generated
        PACKING,              // Warehouse is packing the order
        PACKED,               // Packed and ready for dispatch
        DISPATCHED,           // Delivery person collected
        DELIVERED,            // Delivered to customer
        RETURN_TO_WAREHOUSE,  // Shop closed / not available — returned to warehouse
        CANCELLED             // Cancelled
    }
}
