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
import java.util.List;
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

    @GetMapping("/daily")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Daily report — orders and collections for a date grouped by salesperson")
    public ResponseEntity<ApiResponse<ReportDtos.DailyReportResponse>> dailyReport(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getDailyReport(tenantId, date)));
    }

    @GetMapping("/aging")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_AGING_VIEW')")
    @Operation(summary = "Outstanding aging report bucketed by 30/60/90+ days")
    public ResponseEntity<ApiResponse<ReportDtos.AgingReportResponse>> agingReport(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOfDate) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getAgingReport(tenantId, asOfDate != null ? asOfDate : LocalDate.now())));
    }

    @GetMapping("/sales-analysis")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_SALES_VIEW')")
    @Operation(summary = "Sales analysis grouped by SALESMAN | PRODUCT | CATEGORY")
    public ResponseEntity<ApiResponse<ReportDtos.SalesAnalysisResponse>> salesAnalysis(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "SALESMAN") ReportDtos.SalesGroupBy groupBy) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getSalesAnalysis(tenantId, from, to, groupBy)));
    }

    @GetMapping("/ledger/customer/{customerId}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_LEDGER_VIEW')")
    @Operation(summary = "Customer ledger with debit/credit entries and running balance")
    public ResponseEntity<ApiResponse<ReportDtos.CustomerLedgerResponse>> customerLedger(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID customerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getCustomerLedger(tenantId, customerId, from, to)));
    }

    @GetMapping("/history/customer/{customerId}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_LEDGER_VIEW')")
    @Operation(summary = "Customer bill-wise collection history")
    public ResponseEntity<ApiResponse<ReportDtos.CustomerHistoryResponse>> customerHistory(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID customerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getCustomerHistory(tenantId, customerId, from, to)));
    }

    @GetMapping("/history/supplier")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_LEDGER_VIEW')")
    @Operation(summary = "Supplier bill-wise purchase & payment history")
    public ResponseEntity<ApiResponse<ReportDtos.SupplierHistoryResponse>> supplierHistory(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam String supplierName,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getSupplierHistory(tenantId, supplierName, from, to)));
    }

    @GetMapping("/ledger/vendors")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_LEDGER_VIEW')")
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

    @GetMapping("/closing-stock")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','CLOSING_STOCK_VIEW')")
    @Operation(summary = "Closing stock — all active products with current stock quantity and value")
    public ResponseEntity<ApiResponse<ReportDtos.ClosingStockResponse>> closingStock(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getClosingStock(tenantId)));
    }

    @GetMapping("/dead-stock")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_DEADSTOCK_VIEW')")
    @Operation(summary = "Dead stock — products not billed in X days, sorted by days idle")
    public ResponseEntity<ApiResponse<List<ReportDtos.DeadStockItem>>> deadStock(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getDeadStock(tenantId, days, brand, category)));
    }

    @GetMapping("/salesman-dead-stock")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_DEADSTOCK_VIEW')")
    @Operation(summary = "Dead stock by salesman — products each salesman has not billed in X days")
    public ResponseEntity<ApiResponse<List<ReportDtos.SalesmanDeadStockItem>>> salesmanDeadStock(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(required = false) UUID salesPersonId) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getSalesmanDeadStock(tenantId, days, salesPersonId)));
    }

    @GetMapping("/collection-detail")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Collection detail — every payment record for a date range (downloadable)")
    public ResponseEntity<ApiResponse<List<ReportDtos.CollectionDetailRow>>> collectionDetail(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getCollectionDetail(tenantId, from, to)));
    }

    @GetMapping("/purchase-register")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Purchase register — line-item level for all purchases (GST audit / ITC)")
    public ResponseEntity<ApiResponse<List<ReportDtos.PurchaseRegisterRow>>> purchaseRegister(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getPurchaseRegister(tenantId, from, to)));
    }

    @GetMapping("/sales-register")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Sales register — line-item level for DELIVERED orders (GST audit export)")
    public ResponseEntity<ApiResponse<List<ReportDtos.SalesRegisterRow>>> salesRegister(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getSalesRegister(tenantId, from, to)));
    }

    @GetMapping("/gstr1")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "GSTR-1 — sales split B2B (invoice-wise) / B2C (consolidated), plus HSN summary and credit notes")
    public ResponseEntity<ApiResponse<ReportDtos.Gstr1Response>> gstr1(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getGstr1(tenantId, from, to)));
    }

    @GetMapping("/shortage")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('REPORTS_VIEW')")
    @Operation(summary = "Shortage / Loss report — stock filed as returned/undelivered but never physically received back")
    public ResponseEntity<ApiResponse<ReportDtos.ShortageReportResponse>> shortageReport(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getShortageReport(tenantId, from, to)));
    }

    @GetMapping("/customer-sales")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_SALES_VIEW')")
    @Operation(summary = "Customer Sales — total bills, qty, amount and outstanding per customer for a date range")
    public ResponseEntity<ApiResponse<ReportDtos.CustomerSalesResponse>> customerSales(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getCustomerSales(tenantId, from, to)));
    }

    @GetMapping("/customer-item")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_SALES_VIEW')")
    @Operation(summary = "Customer Item Report — item-wise qty & amount a customer bought in a date range")
    public ResponseEntity<ApiResponse<ReportDtos.CustomerItemResponse>> customerItem(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam UUID customerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getCustomerItemReport(tenantId, customerId, from, to)));
    }

    @GetMapping("/route-item")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_SALES_VIEW')")
    @Operation(summary = "Route Item Report — item-wise movement on a route (omit routeId for all routes)")
    public ResponseEntity<ApiResponse<ReportDtos.RouteItemResponse>> routeItem(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) UUID routeId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getRouteItemReport(tenantId, routeId, from, to)));
    }

    @GetMapping("/item-history")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_SALES_VIEW')")
    @Operation(summary = "Item History — who bought a product and how much (optionally filtered to one customer)")
    public ResponseEntity<ApiResponse<ReportDtos.ItemHistoryResponse>> itemHistory(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam UUID productId,
            @RequestParam(required = false) UUID customerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getItemHistory(tenantId, productId, customerId, from, to)));
    }

    @GetMapping("/route-outstanding")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('REPORTS_VIEW','REPORTS_AGING_VIEW','CUSTOMER_OUTSTANDING_VIEW')")
    @Operation(summary = "Route Outstanding — current dues grouped by route")
    public ResponseEntity<ApiResponse<ReportDtos.RouteOutstandingResponse>> routeOutstanding(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOfDate) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getRouteOutstanding(tenantId, asOfDate != null ? asOfDate : LocalDate.now())));
    }
}
