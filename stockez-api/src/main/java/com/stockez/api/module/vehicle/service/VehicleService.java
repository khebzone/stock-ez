package com.stockez.api.module.vehicle.service;

import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.vehicle.dto.VehicleDtos;
import com.stockez.api.module.vehicle.entity.Vehicle;
import com.stockez.api.module.vehicle.repository.VehicleRepository;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
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
                .fcExpiryDate(req.getFcExpiryDate())
                .insuranceNumber(req.getInsuranceNumber())
                .insuranceExpiryDate(req.getInsuranceExpiryDate())
                .pucExpiryDate(req.getPucExpiryDate())
                .goodsPermitExpiryDate(req.getGoodsPermitExpiryDate())
                .lastServiceDate(req.getLastServiceDate())
                .nextServiceDueDate(req.getNextServiceDueDate())
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
        vehicle.setFcExpiryDate(req.getFcExpiryDate());
        vehicle.setInsuranceNumber(req.getInsuranceNumber());
        vehicle.setInsuranceExpiryDate(req.getInsuranceExpiryDate());
        vehicle.setPucExpiryDate(req.getPucExpiryDate());
        vehicle.setGoodsPermitExpiryDate(req.getGoodsPermitExpiryDate());
        vehicle.setLastServiceDate(req.getLastServiceDate());
        vehicle.setNextServiceDueDate(req.getNextServiceDueDate());
        vehicle.setActive(req.isActive());

        return toResponse(vehicleRepository.save(vehicle));
    }

    @Transactional(readOnly = true)
    public List<VehicleDtos.ExpiryAlert> getExpiryAlerts(UUID tenantId, int daysAhead) {
        LocalDate today = LocalDate.now();
        LocalDate alertDate = today.plusDays(daysAhead);
        List<Vehicle> vehicles = vehicleRepository.findWithExpiringDocuments(tenantId, alertDate);

        List<VehicleDtos.ExpiryAlert> alerts = new ArrayList<>();
        for (Vehicle v : vehicles) {
            addAlert(alerts, v, "FC", v.getFcExpiryDate(), today, alertDate);
            addAlert(alerts, v, "Insurance", v.getInsuranceExpiryDate(), today, alertDate);
            addAlert(alerts, v, "PUC", v.getPucExpiryDate(), today, alertDate);
            addAlert(alerts, v, "Goods Permit", v.getGoodsPermitExpiryDate(), today, alertDate);
        }
        alerts.sort(Comparator.comparingInt(VehicleDtos.ExpiryAlert::getDaysToExpiry));
        return alerts;
    }

    public void deleteVehicle(UUID id, UUID tenantId) {
        Vehicle vehicle = vehicleRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle", id.toString()));
        vehicle.setActive(false);
        vehicleRepository.save(vehicle);
    }

    private void addAlert(List<VehicleDtos.ExpiryAlert> alerts, Vehicle v, String docType,
                           LocalDate expiryDate, LocalDate today, LocalDate alertDate) {
        if (expiryDate == null || expiryDate.isAfter(alertDate)) return;
        VehicleDtos.ExpiryAlert a = new VehicleDtos.ExpiryAlert();
        a.setVehicleId(v.getId());
        a.setVehicleNumber(v.getVehicleNumber());
        a.setVehicleType(v.getVehicleType());
        a.setDocumentType(docType);
        a.setExpiryDate(expiryDate);
        a.setDaysToExpiry((int)(expiryDate.toEpochDay() - today.toEpochDay()));
        alerts.add(a);
    }

    public VehicleDtos.VehicleResponse toResponse(Vehicle v) {
        VehicleDtos.VehicleResponse res = new VehicleDtos.VehicleResponse();
        res.setId(v.getId());
        res.setVehicleNumber(v.getVehicleNumber());
        res.setVehicleType(v.getVehicleType());
        res.setModel(v.getModel());

        LocalDate today = LocalDate.now();

        setExpiryStatus(v.getFcExpiryDate(), today,
                res::setFcExpiryDate, res::setFcExpired, res::setFcNearExpiry, res::setFcDaysToExpiry);
        setExpiryStatus(v.getInsuranceExpiryDate(), today,
                res::setInsuranceExpiryDate, res::setInsuranceExpired, res::setInsuranceNearExpiry, res::setInsuranceDaysToExpiry);
        setExpiryStatus(v.getPucExpiryDate(), today,
                res::setPucExpiryDate, res::setPucExpired, res::setPucNearExpiry, res::setPucDaysToExpiry);
        setExpiryStatus(v.getGoodsPermitExpiryDate(), today,
                res::setGoodsPermitExpiryDate, res::setGoodsPermitExpired, res::setGoodsPermitNearExpiry, res::setGoodsPermitDaysToExpiry);

        res.setInsuranceNumber(v.getInsuranceNumber());
        res.setLastServiceDate(v.getLastServiceDate());
        res.setNextServiceDueDate(v.getNextServiceDueDate());
        res.setActive(v.isActive());
        res.setCreatedAt(v.getCreatedAt());
        return res;
    }

    private void setExpiryStatus(LocalDate expiryDate, LocalDate today,
                                   java.util.function.Consumer<LocalDate> setDate,
                                   java.util.function.Consumer<Boolean> setExpired,
                                   java.util.function.Consumer<Boolean> setNearExpiry,
                                   java.util.function.Consumer<Integer> setDays) {
        setDate.accept(expiryDate);
        if (expiryDate != null) {
            long days = expiryDate.toEpochDay() - today.toEpochDay();
            setDays.accept((int) days);
            setExpired.accept(days < 0);
            setNearExpiry.accept(days >= 0 && days <= 30);
        }
    }
}
