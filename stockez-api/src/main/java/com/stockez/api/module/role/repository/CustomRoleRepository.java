package com.stockez.api.module.role.repository;

import com.stockez.api.module.role.entity.CustomRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomRoleRepository extends JpaRepository<CustomRole, UUID> {

    List<CustomRole> findByTenantIdOrderByNameAsc(UUID tenantId);

    Optional<CustomRole> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByNameAndTenantId(String name, UUID tenantId);

    boolean existsByNameAndTenantIdAndIdNot(String name, UUID tenantId, UUID excludeId);

    long countByTenantId(UUID tenantId);
}
