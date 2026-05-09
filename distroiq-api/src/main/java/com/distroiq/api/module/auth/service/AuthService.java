package com.distroiq.api.module.auth.service;

import com.distroiq.api.module.auth.dto.AuthDtos;
import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.tenant.repository.TenantRepository;
import com.distroiq.api.module.user.entity.User;
import com.distroiq.api.module.user.repository.UserRepository;
import com.distroiq.api.security.jwt.JwtService;
import com.distroiq.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request) {
        // Resolve user: username (phone) > email > phone, all globally (no subdomain required)
        String identifier = request.getUsername() != null ? request.getUsername()
                : request.getPhone() != null ? request.getPhone()
                : request.getEmail();

        if (identifier == null || identifier.isBlank()) {
            throw new BusinessException("Username is required", "INVALID_CREDENTIALS");
        }

        // Try phone first (username field maps to phone), then email
        User user = userRepository.findByPhoneAndActiveTrue(identifier).orElse(null);
        if (user == null) {
            user = userRepository.findByEmailAndActiveTrue(identifier).orElse(null);
        }

        if (user == null) {
            throw new BusinessException("Invalid username or password", "INVALID_CREDENTIALS");
        }

        // If subdomain provided, still validate tenant matches
        if (request.getSubdomain() != null && !request.getSubdomain().isBlank()) {
            Tenant tenant = tenantRepository.findBySubdomain(request.getSubdomain())
                    .orElseThrow(() -> new BusinessException("Invalid credentials", "INVALID_CREDENTIALS"));
            if (!user.getTenant().getId().equals(tenant.getId())) {
                throw new BusinessException("Invalid username or password", "INVALID_CREDENTIALS");
            }
        }

        Tenant tenant = user.getTenant();
        if (tenant.getStatus() != Tenant.TenantStatus.ACTIVE) {
            throw new BusinessException("Your account is suspended. Contact support.", "TENANT_SUSPENDED");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BusinessException("Invalid username or password", "INVALID_CREDENTIALS");
        }

        String accessToken  = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        AuthDtos.UserSummary summary = new AuthDtos.UserSummary();
        summary.setId(user.getId().toString());
        summary.setFullName(user.getFullName());
        summary.setPhone(user.getPhone());
        summary.setRole(user.getRole().name());
        summary.setTenantId(tenant.getId().toString());
        summary.setTenantName(tenant.getName());
        summary.setProfileImageUrl(user.getProfileImageUrl());

        AuthDtos.AuthResponse response = new AuthDtos.AuthResponse();
        response.setAccessToken(accessToken);
        response.setRefreshToken(refreshToken);
        response.setExpiresIn(900);  // 15 min in seconds
        response.setUser(summary);

        return response;
    }

    @Transactional(readOnly = true)
    public AuthDtos.AuthResponse refreshToken(AuthDtos.RefreshTokenRequest request) {
        String token = request.getRefreshToken();

        if (!jwtService.isTokenValid(token) || jwtService.isTokenExpired(token)) {
            throw new BusinessException("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
        }

        String phone = jwtService.extractPhone(token);
        User user = userRepository.findByPhoneAndActiveTrue(phone)
                .orElseThrow(() -> new BusinessException("User not found", "USER_NOT_FOUND"));

        String newAccessToken  = jwtService.generateAccessToken(user);
        String newRefreshToken = jwtService.generateRefreshToken(user);

        AuthDtos.UserSummary summary = new AuthDtos.UserSummary();
        summary.setId(user.getId().toString());
        summary.setFullName(user.getFullName());
        summary.setPhone(user.getPhone());
        summary.setRole(user.getRole().name());
        summary.setTenantId(user.getTenant().getId().toString());
        summary.setTenantName(user.getTenant().getName());

        AuthDtos.AuthResponse response = new AuthDtos.AuthResponse();
        response.setAccessToken(newAccessToken);
        response.setRefreshToken(newRefreshToken);
        response.setExpiresIn(900);
        response.setUser(summary);

        return response;
    }
}
