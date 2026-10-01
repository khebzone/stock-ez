package com.stockez.api.module.product.entity;

import com.stockez.api.module.tenant.entity.Tenant;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "product_masters")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductMaster {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 30)
    private String type; // BRAND, CATEGORY, SUB_CATEGORY, UNIT, TAX_RATE

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 50)
    private String value; // for TAX_RATE stores the % value

    // FK to parent CATEGORY — null for top-level masters (BRAND, CATEGORY, UNIT, TAX_RATE)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private ProductMaster parentMaster;

    @Builder.Default
    private boolean active = true;

    @Builder.Default
    private Integer sortOrder = 0;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public String getParentName() {
        return parentMaster != null ? parentMaster.getName() : null;
    }

    public UUID getParentId() {
        return parentMaster != null ? parentMaster.getId() : null;
    }
}
