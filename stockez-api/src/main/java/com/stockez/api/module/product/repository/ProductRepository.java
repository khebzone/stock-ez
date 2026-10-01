package com.stockez.api.module.product.repository;

import com.stockez.api.module.product.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {

    @EntityGraph(attributePaths = {"brandMaster", "categoryMaster", "subCategoryMaster", "unitMaster"})
    List<Product> findByTenantIdAndActiveTrueOrderByName(UUID tenantId);

    @EntityGraph(attributePaths = {"brandMaster", "categoryMaster", "subCategoryMaster", "unitMaster"})
    Page<Product> findByTenantIdAndActiveTrue(UUID tenantId, Pageable pageable);

    @EntityGraph(attributePaths = {"brandMaster", "categoryMaster", "subCategoryMaster", "unitMaster"})
    Page<Product> findByTenantIdAndCategoryMasterIdAndActiveTrue(UUID tenantId, UUID categoryId, Pageable pageable);

    @EntityGraph(attributePaths = {"brandMaster", "categoryMaster", "subCategoryMaster", "unitMaster"})
    Page<Product> findByTenantIdAndBrandMasterIdAndActiveTrue(UUID tenantId, UUID brandId, Pageable pageable);

    @EntityGraph(attributePaths = {"brandMaster", "categoryMaster", "subCategoryMaster", "unitMaster"})
    @Query("SELECT p FROM Product p LEFT JOIN p.brandMaster b WHERE p.tenant.id = :tenantId AND p.active = true " +
           "AND (LOWER(p.name) LIKE :search OR LOWER(b.name) LIKE :search)")
    Page<Product> searchByNameOrBrand(@Param("tenantId") UUID tenantId, @Param("search") String search, Pageable pageable);

    @EntityGraph(attributePaths = {"brandMaster", "categoryMaster", "subCategoryMaster", "unitMaster"})
    @Query("SELECT p FROM Product p LEFT JOIN p.brandMaster b LEFT JOIN p.categoryMaster c " +
           "WHERE p.tenant.id = :tenantId AND p.active = true " +
           "AND (:brandId IS NULL OR b.id = :brandId) " +
           "AND (:categoryId IS NULL OR c.id = :categoryId) " +
           "AND (:search IS NULL OR LOWER(p.name) LIKE :search OR LOWER(b.name) LIKE :search OR LOWER(p.hsnCode) LIKE :search)")
    Page<Product> findFiltered(@Param("tenantId") UUID tenantId,
                               @Param("brandId") UUID brandId,
                               @Param("categoryId") UUID categoryId,
                               @Param("search") String search,
                               Pageable pageable);

    Optional<Product> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantIdAndActiveTrue(UUID tenantId);

    boolean existsByTenantIdAndNameIgnoreCaseAndActiveTrue(UUID tenantId, String name);

    @EntityGraph(attributePaths = {"brandMaster", "unitMaster"})
    @Query("SELECT p FROM Product p WHERE p.tenant.id = :tenantId AND p.active = true AND LOWER(TRIM(p.name)) = LOWER(TRIM(:name))")
    List<Product> findActiveByTenantAndNameIgnoreCase(@Param("tenantId") UUID tenantId, @Param("name") String name);

    boolean existsByTenantIdAndNameIgnoreCaseAndActiveTrueAndIdNot(UUID tenantId, String name, UUID id);

    @Query("SELECT COUNT(p) FROM Product p WHERE p.tenant.id = :tenantId AND p.active = true " +
           "AND (p.brandMaster.id = :masterId OR p.categoryMaster.id = :masterId OR p.subCategoryMaster.id = :masterId OR p.unitMaster.id = :masterId)")
    long countProductsUsingMaster(@Param("tenantId") UUID tenantId, @Param("masterId") UUID masterId);

    @Query("SELECT DISTINCT p.brandMaster FROM Product p WHERE p.tenant.id = :tenantId AND p.active = true AND p.brandMaster IS NOT NULL ORDER BY p.brandMaster.name ASC")
    List<com.stockez.api.module.product.entity.ProductMaster> findDistinctBrandMastersWithActiveProducts(@Param("tenantId") UUID tenantId);
}
