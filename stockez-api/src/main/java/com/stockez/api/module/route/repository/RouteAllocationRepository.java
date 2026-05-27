package com.stockez.api.module.route.repository;

import com.stockez.api.module.route.entity.RouteAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RouteAllocationRepository extends JpaRepository<RouteAllocation, UUID> {

    List<RouteAllocation> findByTenantIdAndAllocationDateOrderByRoute_Name(UUID tenantId, LocalDate date);

    Optional<RouteAllocation> findByTenantIdAndRouteIdAndAllocationDate(UUID tenantId, UUID routeId, LocalDate date);

    List<RouteAllocation> findByTenantIdAndSalesPersonIdAndAllocationDate(UUID tenantId, UUID salesPersonId, LocalDate date);

    List<RouteAllocation> findByTenantIdAndDeliveryPersonIdAndAllocationDate(UUID tenantId, UUID deliveryPersonId, LocalDate date);

    List<RouteAllocation> findByTenantIdAndDeliveryPersonId(UUID tenantId, UUID deliveryPersonId);

    List<RouteAllocation> findByTenantIdAndWarehousePersonIdAndAllocationDate(UUID tenantId, UUID warehousePersonId, LocalDate date);

    @Query("SELECT COUNT(a) > 0 FROM RouteAllocation a " +
           "WHERE a.tenant.id = :tenantId AND a.allocationDate = :date " +
           "AND (:excludeId IS NULL OR a.id != :excludeId) " +
           "AND a.deliveryVehicle.id = :vehicleId")
    boolean isVehicleUsedAsDelivery(
            @Param("tenantId") UUID tenantId, @Param("vehicleId") UUID vehicleId,
            @Param("date") LocalDate date, @Param("excludeId") UUID excludeId);

    @Query("SELECT COUNT(a) > 0 FROM RouteAllocation a " +
           "WHERE a.tenant.id = :tenantId AND a.allocationDate = :date " +
           "AND (:excludeId IS NULL OR a.id != :excludeId) " +
           "AND a.salesVehicle.id = :vehicleId")
    boolean isVehicleUsedAsSales(
            @Param("tenantId") UUID tenantId, @Param("vehicleId") UUID vehicleId,
            @Param("date") LocalDate date, @Param("excludeId") UUID excludeId);

    @Query("SELECT COUNT(a) > 0 FROM RouteAllocation a " +
           "WHERE a.tenant.id = :tenantId AND a.allocationDate = :date " +
           "AND (:excludeId IS NULL OR a.id != :excludeId) " +
           "AND a.salesPerson.id = :personId")
    boolean isSalesPersonAllocatedOnDate(
            @Param("tenantId") UUID tenantId, @Param("personId") UUID personId,
            @Param("date") LocalDate date, @Param("excludeId") UUID excludeId);

    @Query("SELECT COUNT(a) > 0 FROM RouteAllocation a " +
           "WHERE a.tenant.id = :tenantId AND a.allocationDate = :date " +
           "AND (:excludeId IS NULL OR a.id != :excludeId) " +
           "AND a.deliveryPerson.id = :personId")
    boolean isDeliveryPersonAllocatedOnDate(
            @Param("tenantId") UUID tenantId, @Param("personId") UUID personId,
            @Param("date") LocalDate date, @Param("excludeId") UUID excludeId);

    @Query("SELECT COUNT(a) > 0 FROM RouteAllocation a " +
           "WHERE a.tenant.id = :tenantId AND a.allocationDate = :date " +
           "AND (:excludeId IS NULL OR a.id != :excludeId) " +
           "AND a.warehousePerson.id = :personId")
    boolean isWarehousePersonAllocatedOnDate(
            @Param("tenantId") UUID tenantId, @Param("personId") UUID personId,
            @Param("date") LocalDate date, @Param("excludeId") UUID excludeId);
}
