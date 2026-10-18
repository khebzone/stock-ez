package com.stockez.api.module.attendance.service;

import com.stockez.api.module.attendance.dto.AttendanceDtos;
import com.stockez.api.module.attendance.entity.Attendance;
import com.stockez.api.module.attendance.entity.AttendanceSettings;
import com.stockez.api.module.attendance.repository.AttendanceRepository;
import com.stockez.api.module.attendance.repository.AttendanceSettingsRepository;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.api.module.route.entity.RouteAllocation;
import com.stockez.api.module.route.repository.RouteAllocationRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final AttendanceSettingsRepository settingsRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final RouteAllocationRepository routeAllocationRepository;
    private final AuditService auditService;

    // ── Settings ──────────────────────────────────────────────────────────────

    public AttendanceDtos.SettingsResponse saveSettings(AttendanceDtos.SettingsRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        AttendanceSettings settings = settingsRepository.findByTenantId(tenantId)
                .orElse(AttendanceSettings.builder().tenant(tenant).build());

        settings.setOfficeLatitude(req.getOfficeLatitude());
        settings.setOfficeLongitude(req.getOfficeLongitude());
        if (req.getGeofenceRadiusM() != null) settings.setGeofenceRadiusM(req.getGeofenceRadiusM());
        if (req.getLateThresholdTime() != null) {
            settings.setLateThresholdTime(LocalTime.parse(req.getLateThresholdTime()));
        }

        return toSettingsResponse(settingsRepository.save(settings));
    }

    @Transactional(readOnly = true)
    public AttendanceDtos.SettingsResponse getSettings(UUID tenantId) {
        return settingsRepository.findByTenantId(tenantId)
                .map(this::toSettingsResponse)
                .orElseGet(() -> {
                    AttendanceDtos.SettingsResponse res = new AttendanceDtos.SettingsResponse();
                    res.setConfigured(false);
                    res.setGeofenceRadiusM(100);
                    res.setLateThresholdTime("09:00");
                    return res;
                });
    }

    // ── Check In ─────────────────────────────────────────────────────────────

    public AttendanceDtos.AttendanceResponse checkIn(AttendanceDtos.CheckInRequest req, UUID tenantId, UUID userId) {
        User user = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        AttendanceSettings settings = settingsRepository.findByTenantId(tenantId).orElse(null);

        if (!canCheckInFromAnywhere(user)) {
            if (settings == null) {
                throw new BusinessException(
                        "Attendance location not configured. Please contact your admin.", "SETTINGS_NOT_CONFIGURED");
            }
            if (settings.getOfficeLatitude() == null || settings.getOfficeLongitude() == null) {
                throw new BusinessException(
                        "Office location not set. Please contact your admin.", "OFFICE_LOCATION_NOT_SET");
            }

            double distanceM = haversineMeters(
                    req.getLatitude(), req.getLongitude(),
                    settings.getOfficeLatitude(), settings.getOfficeLongitude());

            if (distanceM > settings.getGeofenceRadiusM()) {
                throw new BusinessException(
                        String.format("You are %.0f m away from the office. Must be within %d m to check in.",
                                distanceM, settings.getGeofenceRadiusM()),
                        "OUTSIDE_GEOFENCE");
            }
        }

        LocalDate today = LocalDate.now();
        Optional<Attendance> existing = attendanceRepository
                .findByTenantIdAndUserIdAndAttendanceDate(tenantId, userId, today);

        if (existing.isPresent() && existing.get().getCheckInTime() != null) {
            throw new BusinessException("You have already checked in today.", "ALREADY_CHECKED_IN");
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        java.time.Instant now = java.time.Instant.now();
        LocalTime checkInLocalTime = now.atZone(ZoneOffset.UTC).toLocalTime();
        LocalTime lateThreshold = settings != null ? settings.getLateThresholdTime() : LocalTime.of(9, 0);
        Attendance.Status status = checkInLocalTime.isAfter(lateThreshold)
                ? Attendance.Status.LATE : Attendance.Status.PRESENT;

        Attendance attendance = existing.orElse(Attendance.builder().tenant(tenant).user(user).attendanceDate(today).build());
        attendance.setCheckInTime(now);
        attendance.setCheckInLat(req.getLatitude());
        attendance.setCheckInLng(req.getLongitude());
        attendance.setStatus(status);

        return toResponse(attendanceRepository.save(attendance));
    }

    private boolean canCheckInFromAnywhere(User user) {
        return user.getRole() == User.UserRole.SALES;
    }

    // ── Check Out ────────────────────────────────────────────────────────────

    public AttendanceDtos.AttendanceResponse checkOut(UUID tenantId, UUID userId) {
        LocalDate today = LocalDate.now();
        Attendance attendance = attendanceRepository
                .findByTenantIdAndUserIdAndAttendanceDate(tenantId, userId, today)
                .orElseThrow(() -> new BusinessException("You have not checked in today.", "NOT_CHECKED_IN"));

        if (attendance.getCheckInTime() == null) {
            throw new BusinessException("You have not checked in today.", "NOT_CHECKED_IN");
        }
        if (attendance.getCheckOutTime() != null) {
            throw new BusinessException("You have already checked out today.", "ALREADY_CHECKED_OUT");
        }

        attendance.setCheckOutTime(java.time.Instant.now());
        AttendanceDtos.AttendanceResponse response = toResponse(attendanceRepository.save(attendance));
        autoCompleteGatePasses(tenantId, userId, today);
        return response;
    }

    /**
     * Safety net for staff who forget to click Complete on their Gate Pass — checking out
     * of attendance auto-completes any of today's route allocations still open under them
     * (sales/delivery/warehouse). Clicking Complete manually during the day still works as
     * before and is unaffected; this only fills in whatever wasn't already closed.
     */
    private void autoCompleteGatePasses(UUID tenantId, UUID userId, LocalDate today) {
        List<RouteAllocation> touched = new java.util.ArrayList<>();

        for (RouteAllocation a : routeAllocationRepository.findByTenantIdAndSalesPersonIdAndAllocationDate(tenantId, userId, today)) {
            if (!a.isSalesCompleted()) {
                a.setSalesCompleted(true);
                touched.add(a);
                auditService.record(tenantId, "ROUTE_ALLOCATION", a.getId(), "SALES_COMPLETED_AUTO_CHECKOUT",
                        "Sales Gate Pass for " + a.getRoute().getName() + " on " + a.getAllocationDate()
                                + " auto-completed — salesperson checked out for the day without clicking Complete");
            }
        }
        for (RouteAllocation a : routeAllocationRepository.findByTenantIdAndDeliveryPersonIdAndAllocationDate(tenantId, userId, today)) {
            if (!a.isDeliveryCompleted()) {
                a.setDeliveryCompleted(true);
                touched.add(a);
                auditService.record(tenantId, "ROUTE_ALLOCATION", a.getId(), "DELIVERY_COMPLETED_AUTO_CHECKOUT",
                        "Delivery Gate Pass for " + a.getRoute().getName() + " on " + a.getAllocationDate()
                                + " auto-completed — delivery person checked out for the day without clicking Complete");
            }
        }
        for (RouteAllocation a : routeAllocationRepository.findByTenantIdAndWarehousePersonIdAndAllocationDate(tenantId, userId, today)) {
            if (!a.isWarehouseCompleted()) {
                a.setWarehouseCompleted(true);
                touched.add(a);
                auditService.record(tenantId, "ROUTE_ALLOCATION", a.getId(), "WAREHOUSE_COMPLETED_AUTO_CHECKOUT",
                        "Warehouse Gate Pass for " + a.getRoute().getName() + " on " + a.getAllocationDate()
                                + " auto-completed — warehouse person checked out for the day without clicking Complete");
            }
        }

        if (!touched.isEmpty()) {
            routeAllocationRepository.saveAll(touched);
        }
    }

    // ── Today Status (for staff) ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AttendanceDtos.TodayStatusResponse getTodayStatus(UUID tenantId, UUID userId) {
        AttendanceDtos.TodayStatusResponse res = new AttendanceDtos.TodayStatusResponse();
        boolean configured = settingsRepository.findByTenantId(tenantId)
                .map(s -> s.getOfficeLatitude() != null)
                .orElse(false);
        res.setConfigured(configured);
        res.setCheckInAnywhere(userRepository.findByIdAndTenantId(userId, tenantId)
                .map(this::canCheckInFromAnywhere).orElse(false));

        attendanceRepository.findByTenantIdAndUserIdAndAttendanceDate(tenantId, userId, LocalDate.now())
                .ifPresent(a -> {
                    res.setCheckedIn(a.getCheckInTime() != null);
                    res.setCheckedOut(a.getCheckOutTime() != null);
                    res.setCheckInTime(a.getCheckInTime());
                    res.setCheckOutTime(a.getCheckOutTime());
                    res.setStatus(a.getStatus().name());
                });

        return res;
    }

    // ── Admin: list by date ───────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AttendanceDtos.AttendanceResponse> getByDate(UUID tenantId, LocalDate date) {
        return attendanceRepository.findByTenantIdAndAttendanceDateOrderByUserFullNameAsc(tenantId, date)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AttendanceDtos.AttendanceResponse> getByUserAndRange(UUID tenantId, UUID userId, LocalDate from, LocalDate to) {
        return attendanceRepository.findByTenantAndUserAndDateRange(tenantId, userId, from, to)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AttendanceDtos.AttendanceResponse> getByRange(UUID tenantId, LocalDate from, LocalDate to) {
        return attendanceRepository.findByTenantAndDateRange(tenantId, from, to)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private AttendanceDtos.SettingsResponse toSettingsResponse(AttendanceSettings s) {
        AttendanceDtos.SettingsResponse res = new AttendanceDtos.SettingsResponse();
        res.setId(s.getId());
        res.setOfficeLatitude(s.getOfficeLatitude());
        res.setOfficeLongitude(s.getOfficeLongitude());
        res.setGeofenceRadiusM(s.getGeofenceRadiusM());
        res.setLateThresholdTime(s.getLateThresholdTime() != null
                ? s.getLateThresholdTime().toString() : "09:00");
        res.setConfigured(s.getOfficeLatitude() != null && s.getOfficeLongitude() != null);
        return res;
    }

    private AttendanceDtos.AttendanceResponse toResponse(Attendance a) {
        AttendanceDtos.AttendanceResponse res = new AttendanceDtos.AttendanceResponse();
        res.setId(a.getId());
        res.setUserId(a.getUser().getId());
        res.setUserName(a.getUser().getFullName());
        res.setUserRole(a.getUser().getRole().name());
        res.setAttendanceDate(a.getAttendanceDate());
        res.setCheckInTime(a.getCheckInTime());
        res.setCheckOutTime(a.getCheckOutTime());
        res.setStatus(a.getStatus().name());
        res.setCheckedIn(a.getCheckInTime() != null);
        res.setCheckedOut(a.getCheckOutTime() != null);
        return res;
    }
}
