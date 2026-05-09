package com.distroiq.api.module.supplier.entity;

import com.distroiq.api.module.tenant.entity.Tenant;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "suppliers")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 100)
    private String contactPerson;

    @Column(nullable = false, length = 15)
    private String phone;

    @Column(length = 15)
    private String altPhone;

    @Column(length = 100)
    private String email;

    @Column(length = 500)
    private String address;

    @Column(length = 100)
    private String city;

    @Column(length = 50)
    private String state;

    @Column(length = 15)
    private String gstin;

    @Column(length = 20)
    private String fssaiNumber;

    @Column(length = 100)
    private String bankName;

    @Column(length = 30)
    private String bankAccount;

    @Column(length = 15)
    private String bankIfsc;

    @Builder.Default
    private boolean active = true;

    @PrePersist
    @PreUpdate
    void sanitize() {
        name          = clean(name);
        contactPerson = clean(contactPerson);
        phone         = clean(phone);
        altPhone      = clean(altPhone);
        email         = clean(email);
        address       = clean(address);
        city          = clean(city);
        state         = clean(state);
        gstin         = upper(gstin);
        fssaiNumber   = clean(fssaiNumber);
        bankName      = clean(bankName);
        bankAccount   = clean(bankAccount);
        bankIfsc      = upper(bankIfsc);
    }

    private static String clean(String v) {
        if (v == null) return null;
        String s = v.replaceAll("^[\\s\\u00A0\\u200B\\uFEFF\\u200C\\u200D\\u202F\\u2060\\u00AD]+|[\\s\\u00A0\\u200B\\uFEFF\\u200C\\u200D\\u202F\\u2060\\u00AD]+$", "");
        return s.isEmpty() ? null : s;
    }

    private static String upper(String v) {
        String s = clean(v);
        return s != null ? s.toUpperCase() : null;
    }

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
