package com.stockez.api.module.route.controller;

import com.stockez.api.module.route.dto.RouteAllocationDtos;
import com.stockez.api.module.route.service.RouteAllocationService;
import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/route-allocations")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Route Allocations", description = "Daily Gate Pass — sales and delivery assignments")
public class RouteAllocationController {

    private final RouteAllocationService allocationService;

    @PostMapping("/sales")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('GATE_PASS_CREATE')")
    @Operation(summary = "Create or update Sales Gate Pass")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> allocateSales(
            @Valid @RequestBody RouteAllocationDtos.AllocateSalesRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(allocationService.allocateSales(request, tenantId), "Sales gate pass saved"));
    }

    @PostMapping("/delivery")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('GATE_PASS_CREATE')")
    @Operation(summary = "Create or update Delivery Gate Pass")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> allocateDelivery(
            @Valid @RequestBody RouteAllocationDtos.AllocateDeliveryRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(allocationService.allocateDelivery(request, tenantId), "Delivery gate pass saved"));
    }

    @PostMapping("/warehouse")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('GATE_PASS_CREATE')")
    @Operation(summary = "Create or update Warehouse Gate Pass")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> allocateWarehouse(
            @Valid @RequestBody RouteAllocationDtos.AllocateWarehouseRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(allocationService.allocateWarehouse(request, tenantId), "Warehouse gate pass saved"));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('GATE_PASS_CREATE')")
    @Operation(summary = "Create or update full route allocation")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> allocate(
            @Valid @RequestBody RouteAllocationDtos.AllocateRouteRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(allocationService.allocateRoute(request, tenantId), "Route allocated"));
    }

    @GetMapping("/date/{date}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('GATE_PASS_VIEW')")
    @Operation(summary = "Get all gate passes for a specific date")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.DailyAllocationSummary>> getForDate(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.getAllocationsForDate(tenantId, date)));
    }

    @GetMapping("/route/{routeId}/date/{date}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('GATE_PASS_VIEW')")
    @Operation(summary = "Get allocation for a specific route and date")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> getForRouteAndDate(
            @PathVariable UUID routeId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.getAllocation(tenantId, routeId, date)));
    }

    @GetMapping("/my-today")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ROUTES_VIEW','DELIVERY_VIEW')")
    @Operation(summary = "Get today's gate pass and role for the current user")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.MyTodayAllocationResponse>> getMyToday(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.getMyTodayAllocation(tenantId, userId)));
    }

    @GetMapping("/gate-pass-options")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_CREATE','INVOICE_APPROVE','COUNTER_SALE_VIEW')")
    @Operation(summary = "Get recent (last 7 days) sales Gate Passes for Counter Sale attribution")
    public ResponseEntity<ApiResponse<List<RouteAllocationDtos.GatePassOption>>> getGatePassOptions(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.getGatePassOptions(tenantId, userId, hasBroadGatePassAccess())));
    }

    /** ADMIN or anyone who can already view the full Gate Pass board sees every salesperson's; everyone else sees only their own. */
    private boolean hasBroadGatePassAccess() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("GATE_PASS_VIEW"));
    }

    @GetMapping("/delivery-summary")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('DELIVERY_UPDATE','DELIVERY_VIEW')")
    @Operation(summary = "Get per-route PACKED order counts with delivery allocation for a date")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteDeliverySummary>> getDeliveryRouteSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        LocalDate queryDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(ApiResponse.success(allocationService.getDeliveryRouteSummary(tenantId, queryDate)));
    }

    @GetMapping("/warehouse-summary")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PICKLIST_VIEW','PICKLIST_UPDATE')")
    @Operation(summary = "Get per-route APPROVED order counts with warehouse allocation for a date")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteWarehouseSummary>> getWarehouseSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        LocalDate queryDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(ApiResponse.success(allocationService.getWarehouseSummary(tenantId, queryDate)));
    }

    @PostMapping("/{id}/dispatch")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('GATE_PASS_CREATE')")
    @Operation(summary = "Dispatch all packed orders for a route allocation")
    public ResponseEntity<ApiResponse<String>> dispatchOrders(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        int count = allocationService.dispatchPackedOrders(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, count + " order(s) dispatched"));
    }

    @PostMapping("/{id}/complete-sales")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('GATE_PASS_CREATE')")
    @Operation(summary = "Mark the sales trip on a route allocation as completed")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> markSalesComplete(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.markSalesComplete(id, tenantId), "Sales trip marked complete"));
    }

    @PostMapping("/{id}/complete-delivery")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('GATE_PASS_CREATE')")
    @Operation(summary = "Mark the delivery run on a route allocation as completed")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> markDeliveryComplete(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "false") boolean force,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.markDeliveryComplete(id, tenantId, force), "Delivery run marked complete"));
    }

    @PostMapping("/{id}/complete-warehouse")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('GATE_PASS_CREATE')")
    @Operation(summary = "Mark the warehouse task on a route allocation as completed")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.RouteAllocationResponse>> markWarehouseComplete(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.markWarehouseComplete(id, tenantId), "Warehouse task marked complete"));
    }

    @GetMapping("/monitor")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('FIELD_MONITOR_VIEW')")
    @Operation(summary = "Get field activity summary for admin monitoring")
    public ResponseEntity<ApiResponse<RouteAllocationDtos.FieldActivityResponse>> getFieldActivity(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(allocationService.getFieldActivity(tenantId, date)));
    }
}
