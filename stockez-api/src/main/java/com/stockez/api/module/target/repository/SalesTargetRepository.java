package com.stockez.api.module.target.repository;

import com.stockez.api.module.target.entity.SalesTarget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SalesTargetRepository extends JpaRepository<SalesTarget, UUID> {

    Optional<SalesTarget> findByTenantIdAndUserIdAndMonthAndYear(
            UUID tenantId, UUID userId, Integer month, Integer year);

    List<SalesTarget> findByTenantIdAndMonthAndYear(UUID tenantId, Integer month, Integer year);

    @Query("SELECT st FROM SalesTarget st WHERE st.tenant.id = :tenantId AND st.month = :month AND st.year = :year")
    List<SalesTarget> findAllByTenantAndMonthYear(
            @Param("tenantId") UUID tenantId,
            @Param("month") Integer month,
            @Param("year") Integer year);
}
