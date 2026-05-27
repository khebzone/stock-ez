package com.stockez.api.module.vehicle.entity;

import com.stockez.api.module.tenant.entity.Tenant;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "vehicles")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 20)
    private String vehicleNumber;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String vehicleType = "VAN";

    @Column(length = 100)
    private String model;

    @Column(name = "fc_expiry_date")
    private LocalDate fcExpiryDate;

    @Column(length = 50)
    private String insuranceNumber;

    @Column(name = "insurance_expiry_date")
    private LocalDate insuranceExpiryDate;

    @Column(name = "puc_expiry_date")
    private LocalDate pucExpiryDate;

    @Column(name = "goods_permit_expiry_date")
    private LocalDate goodsPermitExpiryDate;

    @Column(name = "last_service_date")
    private LocalDate lastServiceDate;

    @Column(name = "next_service_due_date")
    private LocalDate nextServiceDueDate;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
