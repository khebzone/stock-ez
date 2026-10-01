package com.stockez.api.module.user.dto;

import com.stockez.api.module.user.entity.User;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class UserDtos {

    @Data
    public static class CreateUserRequest {
        @NotBlank(message = "Full name is required")
        @Size(min = 2, max = 100)
        private String fullName;

        @NotBlank(message = "Phone is required")
        @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian phone number")
        private String phone;

        @Email(message = "Enter a valid email")
        private String email;

        private UUID customRoleId;

        @NotBlank(message = "Password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        private String password;

        @DecimalMin(value = "0.0", inclusive = true)
        private BigDecimal salary;

        @Size(max = 20)
        private String employmentType;
    }

    @Data
    public static class UpdateUserRequest {
        @NotBlank
        @Size(min = 2, max = 100)
        private String fullName;

        @Email
        private String email;

        private UUID customRoleId;

        private Boolean active;

        @DecimalMin(value = "0.0", inclusive = true)
        private BigDecimal salary;

        @Size(max = 20)
        private String employmentType;

        @Size(min = 8, message = "Password must be at least 8 characters")
        private String newPassword;
    }

    @Data
    public static class ChangePasswordRequest {
        @NotBlank
        private String oldPassword;

        @NotBlank
        @Size(min = 8, message = "New password must be at least 8 characters")
        private String newPassword;
    }

    @Data
    public static class UserResponse {
        private UUID id;
        private String fullName;
        private String phone;
        private String email;
        private String roleName;
        private UUID customRoleId;
        private String profileImageUrl;
        private boolean active;
        private BigDecimal salary;
        private String employmentType;
        private Instant createdAt;
    }

    @Data
    public static class UserQuotaResponse {
        private long currentCount;
        private int maxUsers;
        private boolean atLimit;
    }
}
