package com.stockez.api.module.audit.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_logs",
    indexes = {
        @Index(name = "idx_audit_entity", columnList = "tenant_id, entity_type, entity_id, performed_at"),
        @Index(name = "idx_audit_tenant",  columnList = "tenant_id, performed_at"),
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 50)
    private String entityType;

    @Column(nullable = false)
    private UUID entityId;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(length = 100)
    private String performedBy;

    @Column(nullable = false)
    @Builder.Default
    private Instant performedAt = Instant.now();
}
