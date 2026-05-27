package com.stockez.api.module.customer.repository;

import com.stockez.api.module.customer.entity.Customer;
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
public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    Page<Customer> findByTenantIdAndRouteIdAndActiveTrue(UUID tenantId, UUID routeId, Pageable pageable);

    List<Customer> findByTenantIdAndRouteIdAndActiveTrue(UUID tenantId, UUID routeId);

    Page<Customer> findByTenantIdAndRoutePlaceIdAndActiveTrue(UUID tenantId, UUID placeId, Pageable pageable);

    // Ordered by visit_order for beat plan
    List<Customer> findByTenantIdAndRoutePlaceIdAndActiveTrueOrderByVisitOrderAsc(UUID tenantId, UUID placeId);

    Optional<Customer> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByRouteIdAndActiveTrue(UUID routeId);

    long countByTenantIdAndActiveTrue(UUID tenantId);

    @Query("SELECT COALESCE(MAX(c.visitOrder), -1) FROM Customer c WHERE c.routePlace.id = :placeId AND c.active = true")
    Integer findMaxVisitOrderByPlaceId(@Param("placeId") UUID placeId);

    boolean existsByTenantIdAndPhoneAndActiveTrue(UUID tenantId, String phone);

    @Query("SELECT c FROM Customer c WHERE c.tenant.id = :tenantId AND c.active = true " +
           "AND (LOWER(c.businessName) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(c.ownerName) LIKE LOWER(CONCAT('%', :q, '%')) OR c.phone LIKE CONCAT('%', :q, '%'))")
    Page<Customer> search(@Param("tenantId") UUID tenantId, @Param("q") String q, Pageable pageable);
}
