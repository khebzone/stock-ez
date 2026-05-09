package com.distroiq.api.module.route.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Sub-place under a Route.
 * Example: Route "Cholapuram" → Places: "Kovilacheri", "Solapuram"
 */
@Entity
@Table(name = "route_places")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RoutePlace {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "route_id", nullable = false)
    private Route route;

    @Column(nullable = false, length = 100)
    private String name; // e.g., "Kovilacheri"

    @Column(length = 500)
    private String description;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Builder.Default
    private boolean active = true;
}
