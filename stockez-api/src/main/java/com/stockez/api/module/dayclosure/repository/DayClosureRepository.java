package com.stockez.api.module.dayclosure.repository;

import com.stockez.api.module.dayclosure.entity.DayClosure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DayClosureRepository extends JpaRepository<DayClosure, UUID> {

    Optional<DayClosure> findByTenantIdAndClosureDate(UUID tenantId, LocalDate date);

    List<DayClosure> findByTenantIdOrderByClosureDateDesc(UUID tenantId);
}
