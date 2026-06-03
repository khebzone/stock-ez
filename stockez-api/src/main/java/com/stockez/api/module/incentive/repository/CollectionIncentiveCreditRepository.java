package com.stockez.api.module.incentive.repository;

import com.stockez.api.module.incentive.entity.CollectionIncentiveCredit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CollectionIncentiveCreditRepository extends JpaRepository<CollectionIncentiveCredit, UUID> {

    Optional<CollectionIncentiveCredit> findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(
            UUID tenantId, UUID salesPersonId, int month, int year);

    List<CollectionIncentiveCredit> findByTenantIdAndTargetMonthAndTargetYearOrderBySalesPersonFullNameAsc(
            UUID tenantId, int month, int year);
}
