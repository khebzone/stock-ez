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
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Create purchase entry — adds stock batches [ADMIN/WAREHOUSE]")
    public ResponseEntity<ApiResponse<PurchaseDtos.PurchaseEntryResponse>> create(
            @Valid @RequestBody PurchaseDtos.CreatePurchaseRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(purchaseService.createPurchaseEntry(request, userId, tenantId), "Purchase entry created"));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "List purchase entries with optional filters [ADMIN/WAREHOUSE]")
    public ResponseEntity<ApiResponse<PagedResponse<PurchaseDtos.PurchaseEntryResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String supplierName,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Page<PurchaseDtos.PurchaseEntryResponse> result = purchaseService.listPurchases(
                tenantId, supplierName, from, to, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Get purchase entry detail [ADMIN/WAREHOUSE]")
    public ResponseEntity<ApiResponse<PurchaseDtos.PurchaseEntryResponse>> getById(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getPurchaseEntry(id, tenantId)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update purchase entry header [ADMIN]")
    public ResponseEntity<ApiResponse<PurchaseDtos.PurchaseEntryResponse>> update(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PurchaseDtos.UpdatePurchaseRequest req) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(purchaseService.updatePurchaseEntry(id, tenantId, userId, req), "Purchase updated"));
    }

    @GetMapping("/{id}/audit")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Get audit history for a purchase entry [ADMIN/WAREHOUSE]")
    public ResponseEntity<ApiResponse<List<PurchaseDtos.AuditLogResponse>>> getAudit(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getAuditHistory(id, tenantId)));
    }

    @GetMapping("/batches")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "List all stock batches [ADMIN/WAREHOUSE]")
    public ResponseEntity<ApiResponse<PagedResponse<PurchaseDtos.StockBatchResponse>>> getAllBatches(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "active") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = purchaseService.getAllBatches(tenantId, status, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @GetMapping("/batches/product/{productId}")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE','SALES')")
    @Operation(summary = "Get stock batches for a product")
    public ResponseEntity<ApiResponse<List<PurchaseDtos.StockBatchResponse>>> getBatchesByProduct(
            @PathVariable UUID productId, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(purchaseService.getBatchesByProduct(productId, tenantId)));
    }

    @GetMapping("/alerts/near-expiry")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Get near-expiry stock alerts (default 30 days) [ADMIN/WAREHOUSE]")
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
