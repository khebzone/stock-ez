package com.distroiq.api.module.product.repository;

import com.distroiq.api.module.product.entity.ProductMaster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductMasterRepository extends JpaRepository<ProductMaster, UUID> {
    List<ProductMaster> findByTenantIdAndTypeAndActiveTrueOrderBySortOrderAscNameAsc(UUID tenantId, String type);
    Optional<ProductMaster> findByIdAndTenantId(UUID id, UUID tenantId);
    boolean existsByTenantIdAndTypeAndNameIgnoreCaseAndActiveTrue(UUID tenantId, String type, String name);
}
