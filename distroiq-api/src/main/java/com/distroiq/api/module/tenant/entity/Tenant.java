package com.distroiq.api.module.tenant.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Represents a distributor company using the DistroIQ platform.
 * Each tenant is completely isolated from other tenants.
 */
@Entity
@Table(name = "tenants")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 50)
    private String schemaName; // e.g., "tenant_abc"

    @Column(nullable = false, unique = true, length = 100)
    private String subdomain; // e.g., "abc" → abc.distroiq.com

    @Column(nullable = false, length = 50)
    private String ownerName;

    @Column(nullable = false, unique = true, length = 15)
    private String phone;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(length = 15)
    private String gstin;

    @Column(length = 20)
    private String fssaiNumber;

    @Column(length = 10)
    private String panNumber;

    @Column(length = 500)
    private String address;

    @Column(length = 100)
    private String city;

    @Column(length = 50)
    private String state;

    @Column(length = 10)
    private String pinCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TenantStatus status = TenantStatus.ACTIVE;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public enum TenantStatus {
        ACTIVE, SUSPENDED, TRIAL, INACTIVE
    }
}
