package com.stockez.api.module.role.controller;

import com.stockez.api.module.role.dto.CustomRoleDtos;
import com.stockez.api.module.role.service.CustomRoleService;
import com.stockez.common.response.ApiResponse;
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
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
@Tag(name = "Roles", description = "Custom role management")
public class CustomRoleController {

    private final CustomRoleService roleService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<CustomRoleDtos.RoleResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(roleService.getAllRoles(tenantId)));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<CustomRoleDtos.RoleSummary>>> summaries(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(roleService.getRoleSummaries(tenantId)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomRoleDtos.RoleResponse>> getById(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(roleService.getRoleById(id, tenantId)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomRoleDtos.RoleResponse>> create(
            @Valid @RequestBody CustomRoleDtos.CreateRoleRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(roleService.createRole(request, tenantId), "Role created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomRoleDtos.RoleResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody CustomRoleDtos.UpdateRoleRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(roleService.updateRole(id, request, tenantId), "Role updated"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        roleService.deleteRole(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Role deleted"));
    }
}
