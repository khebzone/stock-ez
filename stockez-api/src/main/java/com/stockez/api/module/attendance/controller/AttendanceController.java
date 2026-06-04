package com.stockez.api.module.attendance.controller;

import com.stockez.api.module.attendance.dto.AttendanceDtos;
import com.stockez.api.module.attendance.service.AttendanceService;
import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/attendance")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Attendance", description = "Attendance management with GPS geofencing")
public class AttendanceController {

    private final AttendanceService attendanceService;

    @PostMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Save office location and attendance settings [ADMIN]")
    public ResponseEntity<ApiResponse<AttendanceDtos.SettingsResponse>> saveSettings(
            @Valid @RequestBody AttendanceDtos.SettingsRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(
                attendanceService.saveSettings(request, tenantId), "Settings saved"));
    }

    @GetMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get attendance settings")
    public ResponseEntity<ApiResponse<AttendanceDtos.SettingsResponse>> getSettings(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(attendanceService.getSettings(tenantId)));
    }

    @PostMapping("/check-in")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Check in with GPS location")
    public ResponseEntity<ApiResponse<AttendanceDtos.AttendanceResponse>> checkIn(
            @Valid @RequestBody AttendanceDtos.CheckInRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                attendanceService.checkIn(request, tenantId, userId), "Checked in successfully"));
    }

    @PostMapping("/check-out")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Check out")
    public ResponseEntity<ApiResponse<AttendanceDtos.AttendanceResponse>> checkOut(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                attendanceService.checkOut(tenantId, userId), "Checked out successfully"));
    }

    @GetMapping("/today-status")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get today's check-in status for the current user")
    public ResponseEntity<ApiResponse<AttendanceDtos.TodayStatusResponse>> todayStatus(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(attendanceService.getTodayStatus(tenantId, userId)));
    }

    @GetMapping("/by-date")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get attendance for all staff on a date [ADMIN]")
    public ResponseEntity<ApiResponse<List<AttendanceDtos.AttendanceResponse>>> byDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(attendanceService.getByDate(tenantId, date)));
    }

    @GetMapping("/by-range")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get attendance for all staff in a date range [ADMIN]")
    public ResponseEntity<ApiResponse<List<AttendanceDtos.AttendanceResponse>>> byRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(attendanceService.getByRange(tenantId, from, to)));
    }

    @GetMapping("/by-user")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get attendance for a specific user in a date range [ADMIN]")
    public ResponseEntity<ApiResponse<List<AttendanceDtos.AttendanceResponse>>> byUser(
            @RequestParam UUID userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(
                attendanceService.getByUserAndRange(tenantId, userId, from, to)));
    }
}
