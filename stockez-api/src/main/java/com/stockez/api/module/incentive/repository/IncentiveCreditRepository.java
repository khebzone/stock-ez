package com.stockez.api.module.incentive.repository;

import com.stockez.api.module.incentive.entity.IncentiveCredit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface IncentiveCreditRepository extends JpaRepository<IncentiveCredit, UUID> {

    List<IncentiveCredit> findByTenantIdAndTargetMonthAndTargetYearOrderBySalesPersonFullNameAscBrandAsc(
            UUID tenantId, int targetMonth, int targetYear);

    List<IncentiveCredit> findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(
            UUID tenantId, UUID salesPersonId, int targetMonth, int targetYear);

    Optional<IncentiveCredit> findByTenantIdAndSalesPersonIdAndBrandAndTargetMonthAndTargetYear(
            UUID tenantId, UUID salesPersonId, String brand, int targetMonth, int targetYear);
}
