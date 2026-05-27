package com.stockez.api.module.attendance.entity;

import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "attendance",
    uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "user_id", "attendance_date"}),
    indexes = {
        @Index(name = "idx_attendance_tenant_date", columnList = "tenant_id,attendance_date"),
        @Index(name = "idx_attendance_user", columnList = "tenant_id,user_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Attendance {

    public enum Status { PRESENT, LATE, ABSENT }

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
    private LocalDate attendanceDate;

    private Instant checkInTime;
    private Instant checkOutTime;
    private Double checkInLat;
    private Double checkInLng;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.ABSENT;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
