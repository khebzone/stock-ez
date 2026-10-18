package com.stockez.api.module.tracking.repository;

import com.stockez.api.module.tracking.entity.StaffLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface StaffLocationRepository extends JpaRepository<StaffLocation, UUID> {

    @Query("SELECT s FROM StaffLocation s WHERE s.tenant.id = :tenantId AND s.user.id = :userId " +
           "AND s.recordedAt BETWEEN :from AND :to ORDER BY s.recordedAt ASC")
    List<StaffLocation> findTrail(@Param("tenantId") UUID tenantId,
                                  @Param("userId") UUID userId,
                                  @Param("from") Instant from,
                                  @Param("to") Instant to);

    /**
     * Latest ping per user in one pass. Native because DISTINCT ON has no JPQL equivalent, and the
     * alternative — a correlated max(recorded_at) subquery per user — degrades as the trail grows.
     */
    @Query(value = """
            SELECT DISTINCT ON (user_id) user_id, latitude, longitude, accuracy_m, recorded_at, source
              FROM staff_locations
             WHERE tenant_id = :tenantId AND recorded_at >= :since
             ORDER BY user_id, recorded_at DESC
            """, nativeQuery = true)
    List<Object[]> findLatestPerUser(@Param("tenantId") UUID tenantId, @Param("since") Instant since);

    @Modifying
    @Query("DELETE FROM StaffLocation s WHERE s.tenant.id = :tenantId AND s.recordedAt < :cutoff")
    int deleteOlderThanForTenant(@Param("tenantId") UUID tenantId, @Param("cutoff") Instant cutoff);
}
