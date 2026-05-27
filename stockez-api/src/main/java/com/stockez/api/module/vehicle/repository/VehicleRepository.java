package com.stockez.api.module.vehicle.repository;

import com.stockez.api.module.vehicle.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, UUID> {

    List<Vehicle> findByTenantIdAndActiveTrueOrderByVehicleNumberAsc(UUID tenantId);

    List<Vehicle> findByTenantIdOrderByVehicleNumberAsc(UUID tenantId);

    Optional<Vehicle> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndVehicleNumberIgnoreCaseAndActiveTrue(UUID tenantId, String vehicleNumber);

    @Query("SELECT v FROM Vehicle v WHERE v.tenant.id = :tenantId AND v.active = true AND (" +
           "(v.fcExpiryDate IS NOT NULL AND v.fcExpiryDate <= :alertDate) OR " +
           "(v.insuranceExpiryDate IS NOT NULL AND v.insuranceExpiryDate <= :alertDate) OR " +
           "(v.pucExpiryDate IS NOT NULL AND v.pucExpiryDate <= :alertDate) OR " +
           "(v.goodsPermitExpiryDate IS NOT NULL AND v.goodsPermitExpiryDate <= :alertDate)" +
           ") ORDER BY v.vehicleNumber ASC")
    List<Vehicle> findWithExpiringDocuments(@Param("tenantId") UUID tenantId, @Param("alertDate") LocalDate alertDate);
}
