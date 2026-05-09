package com.distroiq.api.module.route.entity;

import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.user.entity.User;
import com.distroiq.api.module.vehicle.entity.Vehicle;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "route_allocations",
    uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "route_id", "allocation_date"}),
    indexes = {
        @Index(name = "idx_allocation_tenant", columnList = "tenant_id"),
        @Index(name = "idx_allocation_date", columnList = "allocation_date"),
        @Index(name = "idx_allocation_sales_person", columnList = "sales_person_id"),
        @Index(name = "idx_allocation_delivery_person", columnList = "delivery_person_id"),
        @Index(name = "idx_allocation_route", columnList = "route_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RouteAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "route_id", nullable = false)
    private Route route;

    @Column(name = "allocation_date", nullable = false)
    private LocalDate allocationDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sales_person_id")
    private User salesPerson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delivery_person_id")
    private User deliveryPerson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sales_vehicle_id")
    private Vehicle salesVehicle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delivery_vehicle_id")
    private Vehicle deliveryVehicle;

    @Column(name = "sales_start_km")
    private Integer salesStartKm;

    @Column(name = "sales_end_km")
    private Integer salesEndKm;

    @Column(name = "delivery_start_km")
    private Integer deliveryStartKm;

    @Column(name = "delivery_end_km")
    private Integer deliveryEndKm;

    @Column(length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(length = 500)
    private String notes;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
