package com.distroiq.api.module.route.entity;

import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Delivery/Sales Route.
 * Example: Route "Cholapuram" has places [Kovilacheri, Solapuram]
 */
@Entity
@Table(name = "routes",
    indexes = { @Index(name = "idx_route_tenant", columnList = "tenant_id") }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 100)
    private String name; // e.g., "Cholapuram"

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    // Assigned Sales Person for this route
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_sales_person_id")
    private User assignedSalesPerson;

    // Sub-places under this route
    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RoutePlace> places = new ArrayList<>();

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
