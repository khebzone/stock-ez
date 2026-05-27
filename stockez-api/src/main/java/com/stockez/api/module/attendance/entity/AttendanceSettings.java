package com.stockez.api.module.attendance.entity;

import com.stockez.api.module.tenant.entity.Tenant;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "attendance_settings")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AttendanceSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false, unique = true)
    private Tenant tenant;

    private Double officeLatitude;
    private Double officeLongitude;

    @Builder.Default
    @Column(name = "geofence_radius_m", nullable = false)
    private Integer geofenceRadiusM = 100;

    @Builder.Default
    @Column(nullable = false)
    private LocalTime lateThresholdTime = LocalTime.of(9, 0);

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
