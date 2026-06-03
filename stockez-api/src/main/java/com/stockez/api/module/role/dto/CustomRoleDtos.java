package com.stockez.api.module.role.dto;

import com.stockez.api.module.role.entity.Permission;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public class CustomRoleDtos {

    @Data
    public static class CreateRoleRequest {
        @NotBlank(message = "Role name is required")
        @Size(min = 2, max = 100)
        private String name;

        @NotNull(message = "Permissions are required")
        private Set<Permission> permissions;
    }

    @Data
    public static class UpdateRoleRequest {
        @NotBlank(message = "Role name is required")
        @Size(min = 2, max = 100)
        private String name;

        @NotNull(message = "Permissions are required")
        private Set<Permission> permissions;
    }

    @Data
    public static class RoleResponse {
        private UUID id;
        private String name;
        private Set<Permission> permissions;
        private long userCount;
        private Instant createdAt;
    }

    @Data
    public static class RoleSummary {
        private UUID id;
        private String name;
        private Set<Permission> permissions;
    }
}
