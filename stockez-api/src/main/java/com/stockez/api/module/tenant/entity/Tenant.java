package com.stockez.api.module.tenant.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

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
    private String schemaName;

    @Column(nullable = false, unique = true, length = 100)
    private String subdomain;

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

    @Column(name = "trial_ends_at")
    private Instant trialEndsAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TenantPlan plan = TenantPlan.TRIAL;

    @Column(name = "billing_cycle", nullable = false, length = 10)
    @Builder.Default
    private String billingCycle = "MONTHLY";

    @Column(name = "plan_end_date")
    private LocalDate planEndDate;

    @Column(name = "max_users", nullable = false)
    @Builder.Default
    private int maxUsers = 5;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "invoice_terms", columnDefinition = "TEXT")
    private String invoiceTerms;

    @Column(name = "extra_image_url", length = 500)
    private String extraImageUrl;

    @Column(name = "payment_qr_image_url", length = 500)
    private String paymentQrImageUrl;

    @Column(name = "bank_name", length = 120)
    private String bankName;

    @Column(name = "bank_account_name", length = 120)
    private String bankAccountName;

    @Column(name = "bank_account_number", length = 40)
    private String bankAccountNumber;

    @Column(name = "bank_branch", length = 120)
    private String bankBranch;

    @Column(name = "bank_ifsc", length = 20)
    private String bankIfsc;

    @Column(name = "state_code", length = 2)
    private String stateCode;

    @Column(name = "invoice_footer_note", length = 500)
    private String invoiceFooterNote;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public enum TenantStatus {
        ACTIVE, SUSPENDED, TRIAL, INACTIVE, READ_ONLY
    }

    public enum TenantPlan {
        TRIAL, ESSENTIALS, PROFESSIONAL, PREMIUM
    }
}
