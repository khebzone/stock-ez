package com.distroiq.api.module.product.repository;

import com.distroiq.api.module.product.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {

    Page<Product> findByTenantIdAndActiveTrue(UUID tenantId, Pageable pageable);

    Page<Product> findByTenantIdAndCategoryAndActiveTrue(UUID tenantId, String category, Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.tenant.id = :tenantId AND p.active = true " +
           "AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(p.brand) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Product> searchByNameOrBrand(@Param("tenantId") UUID tenantId, @Param("search") String search, Pageable pageable);

    Optional<Product> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantIdAndActiveTrue(UUID tenantId);

    boolean existsByTenantIdAndNameIgnoreCaseAndActiveTrue(UUID tenantId, String name);

    boolean existsByTenantIdAndNameIgnoreCaseAndActiveTrueAndIdNot(UUID tenantId, String name, UUID id);

    @Query("SELECT DISTINCT p.category FROM Product p WHERE p.tenant.id = :tenantId AND p.active = true AND p.category IS NOT NULL ORDER BY p.category")
    List<String> findDistinctCategories(@Param("tenantId") UUID tenantId);

    @Query("SELECT DISTINCT p.brand FROM Product p WHERE p.tenant.id = :tenantId AND p.active = true AND p.brand IS NOT NULL ORDER BY p.brand")
    List<String> findDistinctBrands(@Param("tenantId") UUID tenantId);
}
