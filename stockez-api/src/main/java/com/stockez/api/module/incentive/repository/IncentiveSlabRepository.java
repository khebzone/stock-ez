package com.stockez.api.module.incentive.repository;

import com.stockez.api.module.incentive.entity.IncentiveSlab;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface IncentiveSlabRepository extends JpaRepository<IncentiveSlab, UUID> {

    List<IncentiveSlab> findByTenantIdOrderByBrandAscFromPctAsc(UUID tenantId);

    List<IncentiveSlab> findByTenantIdAndBrandOrderByFromPctAsc(UUID tenantId, String brand);

    void deleteByTenantIdAndBrand(UUID tenantId, String brand);
}
