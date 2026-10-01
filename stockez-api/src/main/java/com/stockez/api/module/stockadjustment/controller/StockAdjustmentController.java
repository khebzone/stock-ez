package com.stockez.api.module.stockadjustment.controller;

import com.stockez.api.module.stockadjustment.dto.StockAdjustmentDtos;
import com.stockez.api.module.stockadjustment.service.StockAdjustmentService;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stock-adjustments")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Stock Adjustments", description = "Physical stock reconciliation — excess and shortage adjustments")
public class StockAdjustmentController {

    private final StockAdjustmentService stockAdjustmentService;

    @GetMapping("/batches")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('STOCK_ADJUSTMENT_VIEW')")
    @Operation(summary = "Get active batches for a product to be used on the adjustment screen")
    public ResponseEntity<ApiResponse<List<StockAdjustmentDtos.BatchForAdjustment>>> getBatches(
            @RequestParam UUID productId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(
                stockAdjustmentService.getBatchesForProduct(productId, tenantId)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('STOCK_ADJUSTMENT_CREATE')")
    @Operation(summary = "Record a stock adjustment — updates batch quantity and persists an audit record")
    public ResponseEntity<ApiResponse<StockAdjustmentDtos.AdjustmentResponse>> adjust(
            @Valid @RequestBody StockAdjustmentDtos.AdjustRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                stockAdjustmentService.adjust(request, userId, tenantId),
                "Stock adjusted successfully"));
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('STOCK_ADJUSTMENT_VIEW')")
    @Operation(summary = "Get all stock adjustments without pagination")
    public ResponseEntity<ApiResponse<List<StockAdjustmentDtos.AdjustmentResponse>>> getAll(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(stockAdjustmentService.getAllAdjustments(tenantId)));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('STOCK_ADJUSTMENT_VIEW')")
    @Operation(summary = "List all stock adjustments (audit log)")
    public ResponseEntity<ApiResponse<PagedResponse<StockAdjustmentDtos.AdjustmentResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<StockAdjustmentDtos.AdjustmentResponse> result = stockAdjustmentService.listAdjustments(
                tenantId, PageRequest.of(page, size, Sort.by("createdAt").descending()));
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.<StockAdjustmentDtos.AdjustmentResponse>builder()
                .content(result.getContent())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build()));
    }
}
