package com.stockez.api.module.product.repository;

import com.stockez.api.module.product.entity.ProductMaster;
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
    Optional<ProductMaster> findFirstByTenantIdAndTypeAndNameIgnoreCaseAndActiveTrue(UUID tenantId, String type, String name);
    boolean existsByTenantIdAndTypeAndNameIgnoreCaseAndParentNameIgnoreCaseAndActiveTrue(UUID tenantId, String type, String name, String parentName);
    Optional<ProductMaster> findFirstByTenantIdAndTypeAndNameIgnoreCaseAndParentNameIgnoreCaseAndActiveTrue(UUID tenantId, String type, String name, String parentName);
}
