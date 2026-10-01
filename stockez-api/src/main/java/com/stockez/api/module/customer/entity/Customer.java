package com.stockez.api.module.customer.entity;

import com.stockez.api.module.route.entity.Route;
import com.stockez.api.module.route.entity.RoutePlace;
import com.stockez.api.module.tenant.entity.Tenant;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Customer of the distributor.
 * Belongs to a Route and a specific RoutePlace.
 */
@Entity
@Table(name = "customers",
    indexes = {
        @Index(name = "idx_customer_tenant", columnList = "tenant_id"),
        @Index(name = "idx_customer_route", columnList = "route_id"),
        @Index(name = "idx_customer_place", columnList = "route_place_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 200)
    private String businessName;

    @Column(nullable = false, length = 100)
    private String ownerName;

    @Column(nullable = false, length = 15)
    private String phone;

    @Column(length = 15)
    private String altPhone;

    @Column(length = 100)
    private String email;

    @Column(length = 500)
    private String address;

    @Column(length = 100)
    private String city;

    @Column(length = 50)
    private String state;

    @Column(name = "pin_code", length = 10)
    private String pinCode;

    @Column(length = 15)
    private String gstin;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "route_id", nullable = false)
    private Route route;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "route_place_id", nullable = false)
    private RoutePlace routePlace;

    // Credit settings
    @Builder.Default
    private boolean creditAllowed = false;

    @Builder.Default
    private Integer creditDays = 0;

    @Builder.Default
    private BigDecimal creditLimit = BigDecimal.ZERO;

    // Visit sequence within the place (for salesman & delivery ordering)
    @Column(name = "visit_order", nullable = false)
    @Builder.Default
    private Integer visitOrder = 0;

    // Images
    @Column(name = "owner_image_url", length = 500)
    private String ownerImageUrl;

    @Column(name = "shop_image_url", length = 500)
    private String shopImageUrl;

    // GPS coordinates for delivery map
    private Double latitude;
    private Double longitude;

    @Builder.Default
    private boolean active = true;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
