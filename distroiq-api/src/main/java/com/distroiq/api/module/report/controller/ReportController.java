package com.distroiq.api.module.report.controller;

import com.distroiq.api.module.report.dto.ReportDtos;
import com.distroiq.api.module.report.service.ReportService;
import com.distroiq.common.response.ApiResponse;
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

    // ─── 0. Sales Trend ──────────────────────────────────────────────────────

    @GetMapping("/sales-trend")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Daily revenue trend for a date range [ADMIN/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<ReportDtos.SalesTrendResponse>> salesTrend(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getSalesTrend(tenantId, from, to)));
    }

    // ─── 1. Aging Report ─────────────────────────────────────────────────────

    @GetMapping("/aging")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Outstanding aging report bucketed by 30/60/90+ days [ADMIN/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<ReportDtos.AgingReportResponse>> agingReport(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getAgingReport(tenantId)));
    }

    // ─── 2. Sales Analysis ────────────────────────────────────────────────────

    @GetMapping("/sales-analysis")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Sales analysis grouped by SALESMAN | PRODUCT | CATEGORY [ADMIN/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<ReportDtos.SalesAnalysisResponse>> salesAnalysis(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "SALESMAN") ReportDtos.SalesGroupBy groupBy) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getSalesAnalysis(tenantId, from, to, groupBy)));
    }

    // ─── 3a. Customer Ledger ─────────────────────────────────────────────────

    @GetMapping("/ledger/customer/{customerId}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Customer ledger with debit/credit entries and running balance [ADMIN/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<ReportDtos.CustomerLedgerResponse>> customerLedger(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID customerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getCustomerLedger(tenantId, customerId, from, to)));
    }

    // ─── 3b. Vendor Ledger ────────────────────────────────────────────────────

    @GetMapping("/ledger/vendors")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Vendor purchase summary grouped by supplier [ADMIN/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<ReportDtos.VendorLedgerResponse>> vendorLedger(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getVendorLedger(tenantId, from, to)));
    }
}
