package com.distroiq.api.module.vehicle.service;

import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.tenant.repository.TenantRepository;
import com.distroiq.api.module.vehicle.dto.VehicleDtos;
import com.distroiq.api.module.vehicle.entity.Vehicle;
import com.distroiq.api.module.vehicle.repository.VehicleRepository;
import com.distroiq.common.exception.BusinessException;
import com.distroiq.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class VehicleService {

    private final VehicleRepository vehicleRepository;
    private final TenantRepository tenantRepository;

    public VehicleDtos.VehicleResponse createVehicle(VehicleDtos.CreateVehicleRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        if (vehicleRepository.existsByTenantIdAndVehicleNumberIgnoreCaseAndActiveTrue(tenantId, req.getVehicleNumber())) {
            throw new BusinessException("Vehicle number '" + req.getVehicleNumber() + "' already exists", "DUPLICATE_VEHICLE");
        }

        Vehicle vehicle = Vehicle.builder()
                .tenant(tenant)
                .vehicleNumber(req.getVehicleNumber().toUpperCase())
                .vehicleType(req.getVehicleType())
                .model(req.getModel())
                .insuranceNumber(req.getInsuranceNumber())
                .insuranceExpiryDate(req.getInsuranceExpiryDate())
                .build();

        return toResponse(vehicleRepository.save(vehicle));
    }

    @Transactional(readOnly = true)
    public List<VehicleDtos.VehicleResponse> getAll(UUID tenantId) {
        return vehicleRepository.findByTenantIdOrderByVehicleNumberAsc(tenantId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<VehicleDtos.VehicleResponse> getActive(UUID tenantId) {
        return vehicleRepository.findByTenantIdAndActiveTrueOrderByVehicleNumberAsc(tenantId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public VehicleDtos.VehicleResponse updateVehicle(UUID id, VehicleDtos.UpdateVehicleRequest req, UUID tenantId) {
        Vehicle vehicle = vehicleRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", id.toString()));

        String newNumber = req.getVehicleNumber().toUpperCase();
        if (!newNumber.equals(vehicle.getVehicleNumber()) &&
                vehicleRepository.existsByTenantIdAndVehicleNumberIgnoreCaseAndActiveTrue(tenantId, newNumber)) {
            throw new BusinessException("Vehicle number '" + newNumber + "' already exists", "DUPLICATE_VEHICLE");
        }

        vehicle.setVehicleNumber(newNumber);
        vehicle.setVehicleType(req.getVehicleType());
        vehicle.setModel(req.getModel());
        vehicle.setInsuranceNumber(req.getInsuranceNumber());
        vehicle.setInsuranceExpiryDate(req.getInsuranceExpiryDate());
        vehicle.setActive(req.isActive());

        return toResponse(vehicleRepository.save(vehicle));
    }

    @Transactional(readOnly = true)
    public List<VehicleDtos.InsuranceAlert> getInsuranceAlerts(UUID tenantId, int daysAhead) {
        LocalDate alertDate = LocalDate.now().plusDays(daysAhead);
        return vehicleRepository.findInsuranceExpiring(tenantId, alertDate)
                .stream().map(v -> {
                    VehicleDtos.InsuranceAlert a = new VehicleDtos.InsuranceAlert();
                    a.setVehicleId(v.getId());
                    a.setVehicleNumber(v.getVehicleNumber());
                    a.setVehicleType(v.getVehicleType());
                    a.setInsuranceExpiryDate(v.getInsuranceExpiryDate());
                    long days = v.getInsuranceExpiryDate().toEpochDay() - LocalDate.now().toEpochDay();
                    a.setDaysToExpiry((int) days);
                    return a;
                }).collect(Collectors.toList());
    }

    public void deleteVehicle(UUID id, UUID tenantId) {
        Vehicle vehicle = vehicleRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", id.toString()));
        vehicle.setActive(false);
        vehicleRepository.save(vehicle);
    }

    public VehicleDtos.VehicleResponse toResponse(Vehicle v) {
        VehicleDtos.VehicleResponse res = new VehicleDtos.VehicleResponse();
        res.setId(v.getId());
        res.setVehicleNumber(v.getVehicleNumber());
        res.setVehicleType(v.getVehicleType());
        res.setModel(v.getModel());
        res.setInsuranceNumber(v.getInsuranceNumber());
        res.setInsuranceExpiryDate(v.getInsuranceExpiryDate());
        if (v.getInsuranceExpiryDate() != null) {
            long days = v.getInsuranceExpiryDate().toEpochDay() - LocalDate.now().toEpochDay();
            res.setInsuranceDaysToExpiry((int) days);
            res.setInsuranceExpired(days < 0);
            res.setInsuranceNearExpiry(days >= 0 && days <= 30);
        }
        res.setActive(v.isActive());
        res.setCreatedAt(v.getCreatedAt());
        return res;
    }
}
