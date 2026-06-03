package com.stockez.api.module.incentive.repository;

import com.stockez.api.module.incentive.entity.CollectionTarget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CollectionTargetRepository extends JpaRepository<CollectionTarget, UUID> {

    List<CollectionTarget> findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(
            UUID tenantId, UUID salesPersonId, int month, int year);

    List<CollectionTarget> findByTenantIdAndTargetMonthAndTargetYear(UUID tenantId, int month, int year);
}
