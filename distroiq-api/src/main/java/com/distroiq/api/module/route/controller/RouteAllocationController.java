package com.distroiq.api.module.route.controller;

import com.distroiq.api.module.route.dto.RouteAllocationDtos;
import com.distroiq.api.module.route.service.RouteAllocationService;
import com.distroiq.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/route-allocations")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Route Allocations", description = "Daily Gate Pass — sales and delivery assignments")
public class RouteAllocationController {

    private final RouteAllocationService allocationService;

    @PostMapping("/sales")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create or update Sales Gate Pass [ADMIN]")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> allocateSales(
            @Valid @RequestBody RouteAllocationDtos.AllocateSalesRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(allocationService.allocateSales(request, tenantId), "Sales gate pass saved"));
    }

    @PostMapping("/delivery")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create or update Delivery Gate Pass [ADMIN]")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> allocateDelivery(
            @Valid @RequestBody RouteAllocationDtos.AllocateDeliveryRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(allocationService.allocateDelivery(request, tenantId), "Delivery gate pass saved"));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create or update full route allocation [ADMIN]")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> allocate(
            @Valid @RequestBody RouteAllocationDtos.AllocateRouteRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(allocationService.allocateRoute(request, tenantId), "Route allocated"));
    }

    @GetMapping("/date/{date}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Get all gate passes for a specific date")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.DailyAllocationSummary>> getForDate(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.getAllocationsForDate(tenantId, date)));
    }

    @GetMapping("/route/{routeId}/date/{date}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Get allocation for a specific route and date")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> getForRouteAndDate(
            @PathVariable UUID routeId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.getAllocation(tenantId, routeId, date)));
    }

    @GetMapping("/my-today")
    @PreAuthorize("hasAnyRole('SALES','DELIVERY')")
    @Operation(summary = "Get today's gate pass for the current user")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> getMyToday(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        RouteAllocationDtos.RouteAllocationResponse result = allocationService.getMyTodayAllocation(tenantId, userId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/monitor")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get field activity summary for admin monitoring [ADMIN]")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.FieldActivityResponse>> getFieldActivity(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.getFieldActivity(tenantId, date)));
    }
}
