package com.stockez.api.module.tracking.controller;

import com.stockez.api.module.tracking.dto.TrackingDtos;
import com.stockez.api.module.tracking.service.TrackingService;
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
@RequestMapping("/api/v1/tracking")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Field Tracking", description = "Field staff location and shop visit verification")
public class TrackingController {

    private final TrackingService trackingService;

    @PostMapping("/ping")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Report the current device position")
    public ResponseEntity<ApiResponse<TrackingDtos.PingResponse>> ping(
            @Valid @RequestBody TrackingDtos.PingRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                trackingService.recordPing(request, tenantId, userId)));
    }

    @PostMapping("/visits/no-order")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Log a shop that was visited but placed no order")
    public ResponseEntity<ApiResponse<Void>> logNoOrderVisit(
            @Valid @RequestBody TrackingDtos.NoOrderVisitRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        trackingService.recordNoOrderVisit(request, tenantId, userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Visit recorded"));
    }

    @GetMapping("/visits/today")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Customer ids the current user has already logged a visit for today")
    public ResponseEntity<ApiResponse<List<UUID>>> myVisitsToday(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                trackingService.visitedCustomerIdsToday(tenantId, userId)));
    }

    @GetMapping("/live")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('FIELD_MONITOR_VIEW')")
    @Operation(summary = "Last known position and visit tally for every staff member on duty")
    public ResponseEntity<ApiResponse<TrackingDtos.LiveBoardResponse>> liveBoard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(trackingService.getLiveBoard(tenantId, date)));
    }

    @GetMapping("/staff/{userId}/day")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('FIELD_MONITOR_VIEW')")
    @Operation(summary = "One staff member's trail and shop visits for a date")
    public ResponseEntity<ApiResponse<TrackingDtos.StaffDayResponse>> staffDay(
            @PathVariable UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(
                trackingService.getStaffDay(tenantId, userId, date)));
    }

    @GetMapping("/customers/{customerId}/visits")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('FIELD_MONITOR_VIEW')")
    @Operation(summary = "Recent visit history for one shop")
    public ResponseEntity<ApiResponse<List<TrackingDtos.VisitResponse>>> customerVisits(
            @PathVariable UUID customerId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(
                trackingService.getCustomerVisitHistory(tenantId, customerId)));
    }

    @GetMapping("/settings")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Tracking settings — field apps read this to know whether to report at all")
    public ResponseEntity<ApiResponse<TrackingDtos.TrackingSettingsResponse>> getSettings(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(trackingService.getSettings(tenantId)));
    }

    @PostMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Turn tracking on or off and set the reporting interval")
    public ResponseEntity<ApiResponse<TrackingDtos.TrackingSettingsResponse>> saveSettings(
            @Valid @RequestBody TrackingDtos.TrackingSettingsRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(
                trackingService.saveSettings(request, tenantId), "Tracking settings saved"));
    }
}
