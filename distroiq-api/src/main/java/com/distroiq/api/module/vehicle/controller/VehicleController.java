package com.distroiq.api.module.vehicle.controller;

import com.distroiq.api.module.vehicle.dto.VehicleDtos;
import com.distroiq.api.module.vehicle.service.VehicleService;
import com.distroiq.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vehicles")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Vehicles", description = "Fleet vehicle management")
public class VehicleController {

    private final VehicleService vehicleService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<VehicleDtos.VehicleResponse>> create(
            @Valid @RequestBody VehicleDtos.CreateVehicleRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(vehicleService.createVehicle(request, tenantId), "Vehicle added"));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    public ResponseEntity<ApiResponse<List<VehicleDtos.VehicleResponse>>> getAll(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(vehicleService.getAll(tenantId)));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    public ResponseEntity<ApiResponse<List<VehicleDtos.VehicleResponse>>> getActive(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(vehicleService.getActive(tenantId)));
    }

    @GetMapping("/insurance-alerts")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    public ResponseEntity<ApiResponse<List<VehicleDtos.InsuranceAlert>>> insuranceAlerts(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.success(vehicleService.getInsuranceAlerts(tenantId, days)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<VehicleDtos.VehicleResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody VehicleDtos.UpdateVehicleRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(vehicleService.updateVehicle(id, request, tenantId), "Vehicle updated"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        vehicleService.deleteVehicle(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Vehicle deactivated"));
    }
}
