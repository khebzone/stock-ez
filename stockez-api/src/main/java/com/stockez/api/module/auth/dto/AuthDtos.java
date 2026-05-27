package com.stockez.api.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

public class AuthDtos {

    @Data
    public static class LoginRequest {
        // subdomain is optional — if omitted, user is found globally by phone/email
        private String subdomain;

        // username maps to phone; email kept for backward compat
        private String username;
        private String email;
        private String phone;

        @NotBlank(message = "Password is required")
        private String password;
    }

    @Data
    public static class RefreshTokenRequest {
        @NotBlank(message = "Refresh token is required")
        private String refreshToken;
    }

    @Data
    public static class AuthResponse {
        private String accessToken;
        private String refreshToken;
        private long expiresIn;
        private UserSummary user;
    }

    @Data
    public static class UserSummary {
        private String id;
        private String fullName;
        private String phone;
        private String role;
        private String tenantId;
        private String tenantName;
        private String profileImageUrl;
    }
}
