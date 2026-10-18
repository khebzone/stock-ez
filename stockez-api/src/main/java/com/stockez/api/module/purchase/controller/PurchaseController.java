package com.stockez.api.module.purchase.controller;

import com.stockez.api.module.purchase.dto.PurchaseDtos;
import com.stockez.api.module.purchase.service.PurchaseService;
import com.stockez.common.response.ApiResponse;
import com.stockez.common.response.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/purchases")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Purchases", description = "Purchase entry and stock batch management")
public class PurchaseController {

    private final PurchaseService purchaseService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PURCHASES_CREATE')")
    @Operation(summary = "Create purchase entry — adds stock batches")
    public ResponseEntity<ApiResponse<PurchaseDtos.PurchaseEntryResponse>> create(
            @Valid @RequestBody PurchaseDtos.CreatePurchaseRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(purchaseService.createPurchaseEntry(request, userId, tenantId), "Purchase entry created"));
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PURCHASES_VIEW')")
    @Operation(summary = "Get all purchase entries without pagination")
    public ResponseEntity<ApiResponse<List<PurchaseDtos.PurchaseEntryResponse>>> getAll(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getAllPurchases(tenantId)));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PURCHASES_VIEW')")
    @Operation(summary = "List purchase entries with optional filters")
    public ResponseEntity<ApiResponse<PagedResponse<PurchaseDtos.PurchaseEntryResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String supplierName,
            @RequestParam(required = false) String invoiceNumber,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Page<PurchaseDtos.PurchaseEntryResponse> result = purchaseService.listPurchases(
                tenantId, supplierName, invoiceNumber, from, to, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PURCHASES_VIEW')")
    @Operation(summary = "Get purchase entry detail")
    public ResponseEntity<ApiResponse<PurchaseDtos.PurchaseEntryResponse>> getById(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getPurchaseEntry(id, tenantId)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PURCHASES_EDIT')")
    @Operation(summary = "Update purchase entry header")
    public ResponseEntity<ApiResponse<PurchaseDtos.PurchaseEntryResponse>> update(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PurchaseDtos.UpdatePurchaseRequest req) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(purchaseService.updatePurchaseEntry(id, tenantId, userId, req), "Purchase updated"));
    }

    @PostMapping("/{id}/void")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PURCHASES_EDIT')")
    @Operation(summary = "Void a purchase entered by mistake — only when nothing on it has sold or been paid")
    public ResponseEntity<ApiResponse<PurchaseDtos.PurchaseEntryResponse>> voidEntry(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(purchaseService.voidPurchaseEntry(id, tenantId, userId), "Purchase entry voided"));
    }

    @GetMapping("/{id}/audit")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PURCHASES_VIEW')")
    @Operation(summary = "Get audit history for a purchase entry")
    public ResponseEntity<ApiResponse<List<PurchaseDtos.AuditLogResponse>>> getAudit(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getAuditHistory(id, tenantId)));
    }

    @GetMapping("/batches")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('STOCK_VIEW')")
    @Operation(summary = "List all stock batches")
    public ResponseEntity<ApiResponse<PagedResponse<PurchaseDtos.StockBatchResponse>>> getAllBatches(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "active") String status,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = purchaseService.getAllBatches(tenantId, status, brand, search, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @PutMapping("/batches/{batchId}/rates")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('STOCK_ADJUSTMENT_CREATE')")
    @Operation(summary = "Update a stock batch's min and max sale rate")
    public ResponseEntity<ApiResponse<PurchaseDtos.StockBatchResponse>> updateBatchRates(
            @PathVariable UUID batchId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PurchaseDtos.UpdateBatchRatesRequest req) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(purchaseService.updateBatchRates(batchId, req, tenantId, userId), "Sale rates updated"));
    }

    @GetMapping("/batches/product/{productId}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('STOCK_VIEW','ORDERS_VIEW','ORDERS_CREATE')")
    @Operation(summary = "Get stock batches for a product")
    public ResponseEntity<ApiResponse<List<PurchaseDtos.StockBatchResponse>>> getBatchesByProduct(
            @PathVariable UUID productId, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getBatchesByProduct(productId, tenantId)));
    }

    @GetMapping("/alerts/near-expiry")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('STOCK_VIEW') or hasAuthority('ORDERS_CREATE')")
    @Operation(summary = "Get near-expiry stock alerts (default 30 days)")
    public ResponseEntity<ApiResponse<List<PurchaseDtos.NearExpiryAlert>>> getNearExpiry(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getNearExpiryAlerts(tenantId, days)));
    }

    private <T> PagedResponse<T> toPagedResponse(Page<T> page) {
        return PagedResponse.<T>builder()
                .content(page.getContent()).page(page.getNumber()).size(page.getSize())
                .totalElements(page.getTotalElements()).totalPages(page.getTotalPages()).last(page.isLast())
                .build();
    }
}
