package com.distroiq.api.module.user.controller;

import com.distroiq.api.module.user.dto.UserDtos;
import com.distroiq.api.module.user.entity.User;
import com.distroiq.api.module.user.service.UserService;
import com.distroiq.common.response.ApiResponse;
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
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Users", description = "User management")
public class UserController {

    private final UserService userService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create user [ADMIN]")
    public ResponseEntity<ApiResponse<UserDtos.UserResponse>> create(
            @Valid @RequestBody UserDtos.CreateUserRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(userService.createUser(request, tenantId, User.UserRole.ADMIN), "User created"));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List all users [ADMIN]")
    public ResponseEntity<ApiResponse<Page<UserDtos.UserResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(ApiResponse.success(userService.getAllUsers(tenantId, includeInactive, PageRequest.of(page, size))));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get user by ID [ADMIN]")
    public ResponseEntity<ApiResponse<UserDtos.UserResponse>> getById(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getUserById(id, tenantId)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update user [ADMIN]")
    public ResponseEntity<ApiResponse<UserDtos.UserResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UserDtos.UpdateUserRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(userService.updateUser(id, request, tenantId), "User updated"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Deactivate user [ADMIN]")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        userService.deactivateUser(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "User deactivated"));
    }

    @PostMapping("/{id}/reactivate")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Reactivate user [ADMIN]")
    public ResponseEntity<ApiResponse<Void>> reactivate(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        userService.reactivateUser(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "User reactivated"));
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change own password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody UserDtos.ChangePasswordRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        userService.changePassword(userId, request, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Password changed"));
    }
}
