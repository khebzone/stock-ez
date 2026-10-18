package com.stockez.api.module.tracking.entity;

import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "staff_locations",
    indexes = {
        @Index(name = "idx_staff_loc_user_time", columnList = "tenant_id,user_id,recorded_at"),
        @Index(name = "idx_staff_loc_purge", columnList = "recorded_at")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StaffLocation {

    /** FOREGROUND: web app open. ACTION: stamped by a billing/collection action. BACKGROUND: native app service. */
    public enum Source { FOREGROUND, ACTION, BACKGROUND }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Instant recordedAt;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(name = "accuracy_m")
    private Double accuracyM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Source source;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
