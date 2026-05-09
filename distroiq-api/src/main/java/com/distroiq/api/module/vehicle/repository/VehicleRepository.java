package com.distroiq.api.module.vehicle.repository;

import com.distroiq.api.module.vehicle.entity.Vehicle;
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

    @Query("SELECT v FROM Vehicle v WHERE v.tenant.id = :tenantId AND v.active = true " +
           "AND v.insuranceExpiryDate IS NOT NULL AND v.insuranceExpiryDate <= :alertDate " +
           "ORDER BY v.insuranceExpiryDate ASC")
    List<Vehicle> findInsuranceExpiring(@Param("tenantId") UUID tenantId, @Param("alertDate") LocalDate alertDate);
}
