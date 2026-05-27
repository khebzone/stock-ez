package com.stockez.api.module.sales.controller;

import com.stockez.api.module.sales.dto.SalesDtos;
import com.stockez.api.module.sales.service.SalesService;
import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sales")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Sales", description = "Sales person mobile endpoints")
public class SalesController {

    private final SalesService salesService;

    @GetMapping("/my-allocation")
    @PreAuthorize("hasRole('SALES')")
    @Operation(summary = "Get today's route allocation for the calling sales person [SALES]")
    public ResponseEntity<ApiResponse<SalesDtos.MyAllocationResponse>> getMyAllocation(
            @RequestHeader("X-User-Id") UUID salesPersonId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(salesService.getMyAllocation(salesPersonId, tenantId)));
    }

    @GetMapping("/my-customers")
    @PreAuthorize("hasRole('SALES')")
    @Operation(summary = "Get today's customers for the calling sales person [SALES]")
    public ResponseEntity<ApiResponse<List<SalesDtos.CustomerSummary>>> getMyCustomers(
            @RequestHeader("X-User-Id") UUID salesPersonId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(salesService.getMyCustomers(salesPersonId, tenantId)));
    }

    @GetMapping("/my-history")
    @PreAuthorize("hasRole('SALES')")
    @Operation(summary = "Get daily activity history for the calling sales person [SALES]")
    public ResponseEntity<ApiResponse<SalesDtos.MyHistoryResponse>> getMyHistory(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-User-Id") UUID salesPersonId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(salesService.getMyHistory(salesPersonId, tenantId, date)));
    }
}
