package com.stockez.api.module.incentive.repository;

import com.stockez.api.module.incentive.entity.BrandTarget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BrandTargetRepository extends JpaRepository<BrandTarget, UUID> {

    List<BrandTarget> findByTenantIdAndTargetMonthAndTargetYear(UUID tenantId, int targetMonth, int targetYear);

    List<BrandTarget> findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(
            UUID tenantId, UUID salesPersonId, int targetMonth, int targetYear);

    Optional<BrandTarget> findByTenantIdAndSalesPersonIdAndBrandMasterIdAndTargetMonthAndTargetYear(
            UUID tenantId, UUID salesPersonId, UUID brandMasterId, int targetMonth, int targetYear);
}
