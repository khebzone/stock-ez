package com.distroiq.api.module.goodsreturn.repository;

import com.distroiq.api.module.goodsreturn.entity.GoodsReturn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface GoodsReturnRepository extends JpaRepository<GoodsReturn, UUID> {

    Page<GoodsReturn> findByTenantIdOrderByReturnDateDescCreatedAtDesc(UUID tenantId, Pageable pageable);

    Optional<GoodsReturn> findByIdAndTenantId(UUID id, UUID tenantId);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(g.returnNumber, 10) AS int)), 0) FROM GoodsReturn g " +
           "WHERE g.tenant.id = :tenantId AND g.returnNumber LIKE CONCAT('RTN-', :year, '-%')")
    int findMaxReturnSequence(@Param("tenantId") UUID tenantId, @Param("year") int year);
}
