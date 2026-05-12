package com.distroiq.api.module.accounting.controller;

import com.distroiq.api.module.accounting.dto.AccountingDtos;
import com.distroiq.api.module.accounting.service.AccountingService;
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
@Tag(name = "Reports", description = "Business analytics and accounting reports")
public class AccountingController {

    private final AccountingService accountingService;
    private final ReportService reportService;

    @GetMapping("/sales")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Get sales report [ADMIN/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<AccountingDtos.SalesReportResponse>> salesReport(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(accountingService.getSalesReport(tenantId, from, to)));
    }

    @GetMapping("/collections")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Get collection report with daily breakdown [ADMIN/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<ReportDtos.CollectionReportResponse>> collectionReport(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getCollectionReport(tenantId, from, to)));
    }
}
