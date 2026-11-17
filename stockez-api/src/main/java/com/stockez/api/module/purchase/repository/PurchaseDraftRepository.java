package com.stockez.api.module.purchase.repository;

import com.stockez.api.module.purchase.entity.PurchaseDraft;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PurchaseDraftRepository extends JpaRepository<PurchaseDraft, UUID> {

    List<PurchaseDraft> findByTenantIdOrderByUpdatedAtDesc(UUID tenantId);

    Optional<PurchaseDraft> findByIdAndTenantId(UUID id, UUID tenantId);

    @Modifying
    @Query("DELETE FROM PurchaseDraft d WHERE d.id = :id AND d.tenant.id = :tenantId")
    int deleteOne(@Param("id") UUID id, @Param("tenantId") UUID tenantId);
}
