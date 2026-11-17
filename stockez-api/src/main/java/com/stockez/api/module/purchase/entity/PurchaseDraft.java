package com.stockez.api.module.purchase.entity;

import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "purchase_drafts",
    indexes = @Index(name = "idx_purchase_drafts_tenant", columnList = "tenant_id,updated_at"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PurchaseDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(length = 200)
    private String createdByName;

    @Column(length = 200)
    private String updatedByName;

    @Column(length = 200)
    private String supplierName;

    @Column(length = 50)
    private String invoiceNumber;

    private LocalDate purchaseDate;

    @Column(nullable = false)
    @Builder.Default
    private Integer lineCount = 0;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    // The Purchase Entry screen exactly as it was left; only that screen reads it back.
    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
