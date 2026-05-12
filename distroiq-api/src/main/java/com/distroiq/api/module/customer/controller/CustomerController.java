package com.distroiq.api.module.customer.controller;

import com.distroiq.api.module.customer.dto.CustomerDtos;
import com.distroiq.api.module.customer.service.CustomerService;
import com.distroiq.common.response.ApiResponse;
import com.distroiq.common.response.PagedResponse;
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
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customers")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Customers", description = "Customer management")
public class CustomerController {

    private final CustomerService customerService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    @Operation(summary = "Create customer [ADMIN, SALES]")
    public ResponseEntity<ApiResponse<CustomerDtos.CustomerResponse>> create(
            @Valid @RequestBody CustomerDtos.CreateCustomerRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(customerService.createCustomer(request, tenantId), "Customer created"));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Get customer by ID")
    public ResponseEntity<ApiResponse<CustomerDtos.CustomerResponse>> getById(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.getById(id, tenantId)));
    }

    @GetMapping("/by-route/{routeId}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Get customers by route")
    public ResponseEntity<ApiResponse<PagedResponse<CustomerDtos.CustomerResponse>>> byRoute(
            @PathVariable UUID routeId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<CustomerDtos.CustomerResponse> result = customerService.getByRoute(tenantId, routeId,
                PageRequest.of(page, size, Sort.by("businessName")));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @GetMapping("/by-place/{placeId}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Get customers by place")
    public ResponseEntity<ApiResponse<PagedResponse<CustomerDtos.CustomerResponse>>> byPlace(
            @PathVariable UUID placeId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<CustomerDtos.CustomerResponse> result = customerService.getByPlace(tenantId, placeId,
                PageRequest.of(page, size, Sort.by("businessName")));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @GetMapping("/allocated")
    @PreAuthorize("hasRole('SALES')")
    @Operation(summary = "Get customers allocated to the current sales person's route today")
    public ResponseEntity<ApiResponse<java.util.List<CustomerDtos.CustomerResponse>>> getAllocated(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.getAllocatedCustomers(tenantId, userId)));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','INVOICE')")
    @Operation(summary = "Search customers by name/phone")
    public ResponseEntity<ApiResponse<PagedResponse<CustomerDtos.CustomerResponse>>> search(
            @RequestParam String q,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<CustomerDtos.CustomerResponse> result = customerService.search(tenantId, q,
                PageRequest.of(page, size, Sort.by("businessName")));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update customer [ADMIN]")
    public ResponseEntity<ApiResponse<CustomerDtos.CustomerResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody CustomerDtos.UpdateCustomerRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.updateCustomer(id, request, tenantId), "Customer updated"));
    }

    @PutMapping("/by-place/{placeId}/reorder")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Reorder customers within a place [ADMIN]")
    public ResponseEntity<ApiResponse<java.util.List<CustomerDtos.CustomerResponse>>> reorder(
            @PathVariable UUID placeId,
            @RequestBody CustomerDtos.ReorderCustomersRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.reorderCustomers(placeId, request, tenantId), "Customers reordered"));
    }

    @GetMapping("/{id}/outstanding")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    @Operation(summary = "Get customer outstanding balance with aging buckets")
    public ResponseEntity<ApiResponse<CustomerDtos.CustomerOutstandingResponse>> getOutstanding(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.getOutstanding(id, tenantId)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Soft delete customer [ADMIN]")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        customerService.deactivate(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Customer deactivated"));
    }

    private <T> PagedResponse<T> toPagedResponse(Page<T> page) {
        return PagedResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
