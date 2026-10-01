package com.stockez.api.module.supplier.repository;

import com.stockez.api.module.supplier.entity.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupplierRepository extends JpaRepository<Supplier, UUID> {

    Page<Supplier> findByTenantIdAndActiveTrue(UUID tenantId, Pageable pageable);

    List<Supplier> findByTenantIdAndActiveTrue(UUID tenantId, Sort sort);

    Optional<Supplier> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndPhoneAndActiveTrue(UUID tenantId, String phone);

    Optional<Supplier> findByTenantIdAndNameIgnoreCaseAndActiveTrue(UUID tenantId, String name);

    Optional<Supplier> findByTenantIdAndPhoneAndActiveTrue(UUID tenantId, String phone);

    List<Supplier> findByTenantIdAndActiveTrueOrderByNameAsc(UUID tenantId);

    boolean existsByTenantIdAndPhoneAndActiveTrueAndIdNot(UUID tenantId, String phone, UUID id);

    @Query("SELECT s FROM Supplier s WHERE s.tenant.id = :tenantId AND s.active = true " +
           "AND (LOWER(s.name) LIKE :q OR s.phone LIKE :q)")
    Page<Supplier> search(@Param("tenantId") UUID tenantId, @Param("q") String q, Pageable pageable);
}
