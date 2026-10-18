package com.stockez.api.module.tracking.entity;

import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.Payment;
import com.stockez.api.module.route.entity.RouteAllocation;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "customer_visits",
    indexes = {
        @Index(name = "idx_visit_user_date", columnList = "tenant_id,user_id,visit_date"),
        @Index(name = "idx_visit_customer", columnList = "tenant_id,customer_id,visited_at"),
        @Index(name = "idx_visit_tenant_day", columnList = "tenant_id,visit_date")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CustomerVisit {

    public enum Outcome { ORDER_PLACED, COUNTER_SALE, PAYMENT_COLLECTED, DELIVERED, NO_ORDER, SHOP_CLOSED }

    /**
     * Why a visit has no usable distance. Kept explicit rather than inferred from null columns so the
     * admin report can say "GPS was off" instead of silently reading like an unverified visit.
     */
    public enum LocationStatus { VERIFIED, FAR, NO_SHOP_PIN, GPS_UNAVAILABLE }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_allocation_id")
    private RouteAllocation routeAllocation;

    @Column(nullable = false)
    private LocalDate visitDate;

    @Column(nullable = false)
    private Instant visitedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 25)
    private Outcome outcome;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id")
    @NotFound(action = NotFoundAction.IGNORE)
    private Payment payment;

    private Double latitude;
    private Double longitude;
    @Column(name = "accuracy_m")
    private Double accuracyM;

    @Column(name = "distance_from_shop_m")
    private Integer distanceFromShopM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LocationStatus locationStatus;

    @Column(length = 200)
    private String reason;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
