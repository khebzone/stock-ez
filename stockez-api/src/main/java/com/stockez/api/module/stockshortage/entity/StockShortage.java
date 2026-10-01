package com.stockez.api.module.stockshortage.entity;

import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "stock_shortages",
    indexes = {
        @Index(name = "idx_stock_shortage_tenant_date", columnList = "tenant_id, shortage_date DESC"),
        @Index(name = "idx_stock_shortage_route",       columnList = "tenant_id, route_id"),
        @Index(name = "idx_stock_shortage_person",      columnList = "tenant_id, responsible_person_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StockShortage {

    /** Where the shortage was discovered — both are "goods went out, less came back". */
    public enum SourceType {
        SALES_RETURN, UNDELIVERED_ORDER
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "batch_number", length = 100)
    private String batchNumber;

    @Column(name = "quantity_short", nullable = false)
    private Integer quantityShort;

    @Column(name = "unit_rate", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitRate;

    @Column(name = "loss_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal lossValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private SourceType sourceType;

    @Column(name = "reference_number", nullable = false, length = 50)
    private String referenceNumber;

    @Column(name = "reference_id", nullable = false)
    private UUID referenceId;

    @Column(name = "route_id")
    private UUID routeId;

    @Column(name = "route_name", length = 150)
    private String routeName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsible_person_id")
    private User responsiblePerson;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "verified_by_id", nullable = false)
    private User verifiedBy;

    @Column(name = "shortage_date", nullable = false)
    private LocalDate shortageDate;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
