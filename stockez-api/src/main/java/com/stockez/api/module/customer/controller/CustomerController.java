package com.stockez.api.module.customer.controller;

import com.stockez.api.module.customer.dto.CustomerDtos;
import com.stockez.api.module.customer.service.CustomerService;
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
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('CUSTOMERS_CREATE')")
    @Operation(summary = "Create customer")
    public ResponseEntity<ApiResponse<CustomerDtos.CustomerResponse>> create(
            @Valid @RequestBody CustomerDtos.CreateCustomerRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(customerService.createCustomer(request, tenantId), "Customer created"));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('CUSTOMERS_VIEW','DELIVERY_VIEW','ORDERS_VIEW')")
    @Operation(summary = "Get customer by ID")
    public ResponseEntity<ApiResponse<CustomerDtos.CustomerResponse>> getById(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.getById(id, tenantId)));
    }

    @GetMapping("/by-route/{routeId}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('CUSTOMERS_VIEW','DELIVERY_VIEW','ORDERS_VIEW','ROUTES_VIEW')")
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
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('CUSTOMERS_VIEW','DELIVERY_VIEW','ORDERS_VIEW','ROUTES_VIEW')")
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
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('ROUTES_VIEW')")
    @Operation(summary = "Get customers allocated to the current sales person's route today")
    public ResponseEntity<ApiResponse<java.util.List<CustomerDtos.CustomerResponse>>> getAllocated(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.getAllocatedCustomers(tenantId, userId)));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('CUSTOMERS_VIEW','ORDERS_VIEW','ORDERS_CREATE','INVOICE_APPROVE')")
    @Operation(summary = "List customers with pagination and optional filters")
    public ResponseEntity<ApiResponse<PagedResponse<CustomerDtos.CustomerResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(required = false) UUID routeId,
            @RequestParam(required = false) UUID placeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<CustomerDtos.CustomerResponse> result = customerService.list(tenantId, search, routeId, placeId,
                PageRequest.of(page, size, Sort.by("businessName")));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('CUSTOMERS_VIEW','ORDERS_VIEW','ORDERS_CREATE','INVOICE_APPROVE')")
    @Operation(summary = "Get all active customers sorted by name")
    public ResponseEntity<ApiResponse<java.util.List<CustomerDtos.CustomerResponse>>> getAll(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.getAllActive(tenantId)));
    }

    @GetMapping("/search")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('CUSTOMERS_VIEW','ORDERS_VIEW','ORDERS_CREATE','INVOICE_APPROVE')")
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
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('CUSTOMERS_EDIT')")
    @Operation(summary = "Update customer")
    public ResponseEntity<ApiResponse<CustomerDtos.CustomerResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody CustomerDtos.UpdateCustomerRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.updateCustomer(id, request, tenantId), "Customer updated"));
    }

    @PutMapping("/by-place/{placeId}/reorder")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('CUSTOMERS_EDIT')")
    @Operation(summary = "Reorder customers within a place")
    public ResponseEntity<ApiResponse<java.util.List<CustomerDtos.CustomerResponse>>> reorder(
            @PathVariable UUID placeId,
            @RequestBody CustomerDtos.ReorderCustomersRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.reorderCustomers(placeId, request, tenantId), "Customers reordered"));
    }

    @GetMapping("/{id}/outstanding")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('CUSTOMERS_VIEW','ORDERS_VIEW','PAYMENTS_VIEW')")
    @Operation(summary = "Get customer outstanding balance with aging buckets")
    public ResponseEntity<ApiResponse<CustomerDtos.CustomerOutstandingResponse>> getOutstanding(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(customerService.getOutstanding(id, tenantId)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('CUSTOMERS_DELETE')")
    @Operation(summary = "Soft delete customer")
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
