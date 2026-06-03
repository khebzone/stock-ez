package com.stockez.api.module.incentive.repository;

import com.stockez.api.module.incentive.entity.CollectionIncentiveSlab;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CollectionIncentiveSlabRepository extends JpaRepository<CollectionIncentiveSlab, UUID> {

    List<CollectionIncentiveSlab> findByTenantIdOrderByFromPctAsc(UUID tenantId);

    void deleteByTenantId(UUID tenantId);
}
