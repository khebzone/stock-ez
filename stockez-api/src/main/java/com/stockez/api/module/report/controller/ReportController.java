package com.stockez.api.module.report.controller;

import com.stockez.api.module.report.dto.ReportDtos;
import com.stockez.api.module.report.service.ReportService;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Reports", description = "Aging, sales analysis, and ledger reports")
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/sales-trend")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Daily revenue trend for a date range")
    public ResponseEntity<ApiResponse<ReportDtos.SalesTrendResponse>> salesTrend(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getSalesTrend(tenantId, from, to)));
    }

    @GetMapping("/aging")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Outstanding aging report bucketed by 30/60/90+ days")
    public ResponseEntity<ApiResponse<ReportDtos.AgingReportResponse>> agingReport(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getAgingReport(tenantId)));
    }

    @GetMapping("/sales-analysis")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Sales analysis grouped by SALESMAN | PRODUCT | CATEGORY")
    public ResponseEntity<ApiResponse<ReportDtos.SalesAnalysisResponse>> salesAnalysis(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "SALESMAN") ReportDtos.SalesGroupBy groupBy) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getSalesAnalysis(tenantId, from, to, groupBy)));
    }

    @GetMapping("/ledger/customer/{customerId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Customer ledger with debit/credit entries and running balance")
    public ResponseEntity<ApiResponse<ReportDtos.CustomerLedgerResponse>> customerLedger(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID customerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getCustomerLedger(tenantId, customerId, from, to)));
    }

    @GetMapping("/ledger/vendors")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Vendor purchase summary grouped by supplier")
    public ResponseEntity<ApiResponse<ReportDtos.VendorLedgerResponse>> vendorLedger(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getVendorLedger(tenantId, from, to)));
    }

    @GetMapping("/profit")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Gross profit by route for a date range (DELIVERED orders only)")
    public ResponseEntity<ApiResponse<ReportDtos.ProfitReportResponse>> profitReport(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getProfitReport(tenantId, from, to)));
    }

    @GetMapping("/profit/brand")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Gross profit by brand for a date range (DELIVERED orders only)")
    public ResponseEntity<ApiResponse<ReportDtos.BrandProfitResponse>> brandProfitReport(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getBrandProfitReport(tenantId, from, to)));
    }
}
