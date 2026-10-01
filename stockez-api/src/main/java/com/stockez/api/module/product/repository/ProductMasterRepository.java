package com.stockez.api.module.product.repository;

import com.stockez.api.module.product.entity.ProductMaster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    // Sub-category lookup: find by name + parent FK (not parent name string)
    @Query("SELECT m FROM ProductMaster m WHERE m.tenant.id = :tenantId AND m.type = :type " +
           "AND LOWER(m.name) = LOWER(:name) AND m.parentMaster.id = :parentId AND m.active = true")
    Optional<ProductMaster> findFirstByTenantIdAndTypeAndNameAndParentId(
            @Param("tenantId") UUID tenantId,
            @Param("type") String type,
            @Param("name") String name,
            @Param("parentId") UUID parentId);

    @Query("SELECT CASE WHEN COUNT(m) > 0 THEN true ELSE false END FROM ProductMaster m " +
           "WHERE m.tenant.id = :tenantId AND m.type = :type " +
           "AND LOWER(m.name) = LOWER(:name) AND m.parentMaster.id = :parentId AND m.active = true")
    boolean existsByTenantIdAndTypeAndNameAndParentId(
            @Param("tenantId") UUID tenantId,
            @Param("type") String type,
            @Param("name") String name,
            @Param("parentId") UUID parentId);
}
