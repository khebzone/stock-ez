package com.stockez.api.module.stockshortage.repository;

import com.stockez.api.module.stockshortage.entity.StockShortage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface StockShortageRepository extends JpaRepository<StockShortage, UUID> {

    @Query("SELECT s FROM StockShortage s WHERE s.tenant.id = :tenantId " +
           "AND s.shortageDate BETWEEN :from AND :to ORDER BY s.shortageDate DESC, s.createdAt DESC")
    List<StockShortage> findByTenantAndDateRange(
            @Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
