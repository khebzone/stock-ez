package com.stockez.api.module.tenant.controller;

import com.stockez.api.module.tenant.dto.TenantDtos;
import com.stockez.api.module.tenant.service.TenantService;
import com.stockez.common.response.ApiResponse;
import com.stockez.common.response.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tenants")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Tenants", description = "Tenant management [SUPER_ADMIN only]")
public class TenantController {

    private final TenantService tenantService;

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Create a new tenant [SUPER_ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.TenantResponse>> create(
            @Valid @RequestBody TenantDtos.CreateTenantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(tenantService.createTenant(request), "Tenant created"));
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "List all tenants [SUPER_ADMIN]")
    public ResponseEntity<ApiResponse<PagedResponse<TenantDtos.TenantResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<TenantDtos.TenantResponse> result = tenantService.getAllTenants(PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Get tenant by ID [SUPER_ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.TenantResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.getTenantById(id)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Update tenant [SUPER_ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.TenantResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody TenantDtos.UpdateTenantRequest request) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.updateTenant(id, request), "Tenant updated"));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Get tenant stats [SUPER_ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.TenantStats>> stats() {
        return ResponseEntity.ok(ApiResponse.success(tenantService.getStats()));
    }

    @PostMapping("/{id}/suspend")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Suspend tenant [SUPER_ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.TenantResponse>> suspend(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.suspendTenant(id), "Tenant suspended"));
    }

    @PostMapping("/{id}/activate")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Activate tenant [SUPER_ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.TenantResponse>> activate(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.activateTenant(id), "Tenant activated"));
    }

    @PostMapping("/{id}/set-read-only")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Set tenant to read-only [SUPER_ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.TenantResponse>> setReadOnly(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.setReadOnly(id), "Tenant set to read-only"));
    }

    @PostMapping("/{id}/extend-trial")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Extend tenant trial [SUPER_ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.TenantResponse>> extendTrial(
            @PathVariable UUID id,
            @Valid @RequestBody TenantDtos.ExtendTrialRequest request) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.extendTrial(id, request.getDays()), "Trial extended"));
    }

    @GetMapping("/profile")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get company profile [ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.TenantResponse>> getProfile(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.getTenantById(tenantId)));
    }

    @PutMapping("/profile")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update company profile [ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.TenantResponse>> updateProfile(
            @Valid @RequestBody TenantDtos.CompanyProfileRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.updateProfile(tenantId, request), "Profile updated"));
    }

    @GetMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get workflow settings [ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.WorkflowSettingsResponse>> getSettings(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.getSettings(tenantId)));
    }

    @PutMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update workflow settings [ADMIN]")
    public ResponseEntity<ApiResponse<TenantDtos.WorkflowSettingsResponse>> updateSettings(
            @RequestBody TenantDtos.WorkflowSettingsRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.updateSettings(tenantId, request), "Settings updated"));
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
