package com.stockez.api.module.tenant.repository;

import com.stockez.api.module.tenant.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {

    Optional<Tenant> findBySubdomain(String subdomain);

    boolean existsBySubdomain(String subdomain);

    boolean existsByEmail(String email);

    long countByStatus(Tenant.TenantStatus status);

    List<Tenant> findByStatus(Tenant.TenantStatus status);

    @Query("SELECT COUNT(t) FROM Tenant t WHERE t.planEndDate IS NOT NULL AND t.planEndDate >= :today AND t.planEndDate <= :cutoff AND t.status IN :statuses")
    long countExpiringSoon(
        @Param("today") LocalDate today,
        @Param("cutoff") LocalDate cutoff,
        @Param("statuses") List<Tenant.TenantStatus> statuses
    );
}
