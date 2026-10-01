package com.stockez.api.module.dashboard.controller;

import com.stockez.api.module.dashboard.dto.DashboardDtos;
import com.stockez.api.module.dashboard.service.DashboardService;
import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Dashboard", description = "Dashboard overview and statistics")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/admin")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get admin dashboard overview [office users]")
    public ResponseEntity<ApiResponse<DashboardDtos.AdminDashboardStats>> adminStats(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(dashboardService.getAdminStats(tenantId)));
    }

    @GetMapping("/sales")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('ORDERS_VIEW')")
    @Operation(summary = "Get sales person dashboard overview")
    public ResponseEntity<ApiResponse<DashboardDtos.SalesDashboardStats>> salesStats(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(dashboardService.getSalesStats(tenantId, userId)));
    }

    @GetMapping("/warehouse")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('STOCK_VIEW')")
    @Operation(summary = "Get warehouse dashboard overview")
    public ResponseEntity<ApiResponse<DashboardDtos.WarehouseDashboardStats>> warehouseStats(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(dashboardService.getWarehouseStats(tenantId)));
    }
}
