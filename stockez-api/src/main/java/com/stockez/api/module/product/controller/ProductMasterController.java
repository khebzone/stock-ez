package com.stockez.api.module.product.controller;

import com.stockez.api.module.product.dto.ProductMasterDtos;
import com.stockez.api.module.product.service.ProductMasterService;
import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/product-masters")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Product Masters", description = "Manage brands, categories, units, tax rates")
public class ProductMasterController {

    private final ProductMasterService masterService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ProductMasterDtos.MasterResponse>> create(
            @Valid @RequestBody ProductMasterDtos.CreateMasterRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(masterService.create(request, tenantId), "Created"));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SALES','INVOICE')")
    public ResponseEntity<ApiResponse<List<ProductMasterDtos.MasterResponse>>> getByType(
            @RequestParam String type,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(masterService.getByType(tenantId, type)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        masterService.delete(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Deleted"));
    }
}
