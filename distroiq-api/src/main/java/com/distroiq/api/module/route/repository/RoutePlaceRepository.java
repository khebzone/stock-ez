package com.distroiq.api.module.route.repository;

import com.distroiq.api.module.route.entity.RoutePlace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoutePlaceRepository extends JpaRepository<RoutePlace, UUID> {
    List<RoutePlace> findByRouteIdAndActiveTrueOrderBySortOrderAsc(UUID routeId);
    List<RoutePlace> findByRouteIdAndActiveTrue(UUID routeId);
    Optional<RoutePlace> findByIdAndRouteId(UUID id, UUID routeId);

    @Query("SELECT COALESCE(MAX(p.sortOrder), -1) FROM RoutePlace p WHERE p.route.id = :routeId")
    Integer findMaxSortOrderByRouteId(UUID routeId);
}
