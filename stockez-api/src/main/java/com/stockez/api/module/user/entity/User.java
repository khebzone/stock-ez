package com.stockez.api.module.user.entity;

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
 * System user — Admin, Sales Person, Invoice Person,
 * Warehouse, Delivery Person, Accountant.
 */
@Entity
@Table(name = "users",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"phone", "tenant_id"}),
        @UniqueConstraint(columnNames = {"email", "tenant_id"})
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, length = 15)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    @Column(length = 500)
    private String profileImageUrl;

    @Builder.Default
    private boolean active = true;

    @Builder.Default
    private boolean mustChangePassword = false;

    @Column(precision = 12, scale = 2)
    private BigDecimal salary;

    @Column(length = 20)
    private String employmentType;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public enum UserRole {
        SUPER_ADMIN,   // Platform owner (you)
        ADMIN,         // Distributor owner
        SALES,         // Sales person (mobile)
        INVOICE,       // Invoice/billing person (web)
        WAREHOUSE,     // Warehouse picker (mobile/tablet)
        DELIVERY,      // Delivery person (mobile)
        ACCOUNTANT     // Accountant (web)
    }
}
