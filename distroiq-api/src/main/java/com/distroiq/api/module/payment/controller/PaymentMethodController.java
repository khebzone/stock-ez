package com.distroiq.api.module.payment.controller;

import com.distroiq.api.module.payment.dto.PaymentMethodDtos;
import com.distroiq.api.module.payment.service.PaymentMethodService;
import com.distroiq.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
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
@RequestMapping("/api/v1/payment-methods")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Payment Methods", description = "Admin-managed payment method masters")
public class PaymentMethodController {

    private final PaymentMethodService paymentMethodService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get all active payment methods for tenant")
    public ResponseEntity<ApiResponse<List<PaymentMethodDtos.Response>>> getAll(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentMethodService.getAll(tenantId)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a new payment method [ADMIN]")
    public ResponseEntity<ApiResponse<PaymentMethodDtos.Response>> create(
            @Valid @RequestBody PaymentMethodDtos.CreateRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(paymentMethodService.create(request, tenantId), "Payment method created"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Soft-delete a payment method [ADMIN]")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        paymentMethodService.delete(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Payment method deleted"));
    }
}
