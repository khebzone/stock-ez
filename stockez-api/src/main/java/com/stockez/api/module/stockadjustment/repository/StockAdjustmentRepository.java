package com.stockez.api.module.stockadjustment.repository;

import com.stockez.api.module.stockadjustment.entity.StockAdjustment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StockAdjustmentRepository extends JpaRepository<StockAdjustment, UUID> {

    @Query("SELECT a FROM StockAdjustment a WHERE a.tenant.id = :tenantId ORDER BY a.createdAt DESC")
    Page<StockAdjustment> findByTenantId(@Param("tenantId") UUID tenantId, Pageable pageable);

    @Query("SELECT a FROM StockAdjustment a WHERE a.tenant.id = :tenantId ORDER BY a.createdAt DESC")
    List<StockAdjustment> findAllByTenantId(@Param("tenantId") UUID tenantId);
}
