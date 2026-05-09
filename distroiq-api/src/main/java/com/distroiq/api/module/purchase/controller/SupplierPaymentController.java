package com.distroiq.api.module.purchase.controller;

import com.distroiq.api.module.purchase.dto.SupplierPaymentDtos;
import com.distroiq.api.module.purchase.service.SupplierPaymentService;
import com.distroiq.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supplier-payments")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Supplier Payments", description = "Track payments made to suppliers")
public class SupplierPaymentController {

    private final SupplierPaymentService service;

    @GetMapping("/summaries")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT','WAREHOUSE')")
    public ResponseEntity<ApiResponse<List<SupplierPaymentDtos.SupplierSummary>>> getSummaries(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(service.getSupplierSummaries(tenantId)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT','WAREHOUSE')")
    public ResponseEntity<ApiResponse<List<SupplierPaymentDtos.SupplierPaymentResponse>>> getPayments(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) String supplierName) {
        return ResponseEntity.ok(ApiResponse.success(service.getPayments(tenantId, supplierName)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT','WAREHOUSE')")
    public ResponseEntity<ApiResponse<SupplierPaymentDtos.SupplierPaymentResponse>> createPayment(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SupplierPaymentDtos.CreateSupplierPaymentRequest req) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(service.createPayment(tenantId, userId, req), "Payment recorded"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deletePayment(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID id) {
        service.deletePayment(tenantId, id);
        return ResponseEntity.ok(ApiResponse.success(null, "Payment deleted"));
    }
}
