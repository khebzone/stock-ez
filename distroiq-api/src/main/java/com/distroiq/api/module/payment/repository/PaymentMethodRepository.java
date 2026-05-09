package com.distroiq.api.module.payment.repository;

import com.distroiq.api.module.payment.entity.PaymentMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentMethodRepository extends JpaRepository<PaymentMethod, UUID> {

    List<PaymentMethod> findByTenantIdAndActiveTrueOrderBySortOrderAscNameAsc(UUID tenantId);

    Optional<PaymentMethod> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndNameIgnoreCaseAndActiveTrue(UUID tenantId, String name);
}
