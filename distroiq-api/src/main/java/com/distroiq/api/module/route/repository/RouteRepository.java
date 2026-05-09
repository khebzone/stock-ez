package com.distroiq.api.module.route.repository;

import com.distroiq.api.module.route.entity.Route;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RouteRepository extends JpaRepository<Route, UUID> {
    List<Route> findByTenantIdAndActiveTrue(UUID tenantId);
    Optional<Route> findByIdAndTenantId(UUID id, UUID tenantId);
    Optional<Route> findByTenantIdAndAssignedSalesPersonId(UUID tenantId, UUID salesPersonId);

    Optional<Route> findByTenantIdAndNameIgnoreCaseAndActiveTrue(UUID tenantId, String name);
}
