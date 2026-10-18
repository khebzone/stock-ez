package com.stockez.api.module.auth.service;

import com.stockez.api.module.auth.dto.AuthDtos;
import com.stockez.api.module.role.entity.Permission;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.api.security.jwt.JwtService;
import com.stockez.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request, String tenantSlug) {
        String identifier = request.getUsername() != null ? request.getUsername()
                : request.getPhone() != null ? request.getPhone()
                : request.getEmail();

        if (identifier == null || identifier.isBlank()) {
            throw new BusinessException("Username is required", "INVALID_CREDENTIALS");
        }

        User user;
        if (tenantSlug != null && !tenantSlug.isBlank()) {
            // Tenant login — resolve tenant by subdomain slug
            Tenant tenant = tenantRepository.findBySubdomain(tenantSlug)
                    .orElseThrow(() -> new BusinessException("Company not found. Check your login URL.", "INVALID_SUBDOMAIN"));
            user = userRepository.findByPhoneAndTenant_IdAndActiveTrue(identifier, tenant.getId())
                    .or(() -> userRepository.findByEmailAndTenant_IdAndActiveTrue(identifier, tenant.getId()))
                    .orElse(null);
        } else {
            // No slug — super admin login only (stockez.in)
            user = userRepository.findAllByPhoneAndActiveTrue(identifier).stream()
                    .filter(u -> u.getRole() == User.UserRole.SUPER_ADMIN)
                    .findFirst()
                    .orElse(null);
            if (user == null) {
                user = userRepository.findByEmailAndActiveTrue(identifier)
                        .filter(u -> u.getRole() == User.UserRole.SUPER_ADMIN)
                        .orElse(null);
            }
        }

        if (user == null) {
            throw new BusinessException("Invalid username or password", "INVALID_CREDENTIALS");
        }

        Tenant tenant = user.getTenant();
        if (tenant.getStatus() == Tenant.TenantStatus.SUSPENDED) {
            throw new BusinessException("Your account has been suspended. Please contact support.", "TENANT_SUSPENDED");
        }
        if (tenant.getStatus() == Tenant.TenantStatus.INACTIVE) {
            throw new BusinessException("Your account is inactive. Please contact support.", "TENANT_INACTIVE");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BusinessException("Invalid username or password", "INVALID_CREDENTIALS");
        }

        String accessToken  = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        AuthDtos.UserSummary summary = buildSummary(user, tenant);

        AuthDtos.AuthResponse response = new AuthDtos.AuthResponse();
        response.setAccessToken(accessToken);
        response.setRefreshToken(refreshToken);
        response.setExpiresIn(900);
        response.setUser(summary);

        return response;
    }

    @Transactional(readOnly = true)
    public AuthDtos.AuthResponse refreshToken(AuthDtos.RefreshTokenRequest request) {
        String token = request.getRefreshToken();

        if (!jwtService.isTokenValid(token) || jwtService.isTokenExpired(token)) {
            throw new BusinessException("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
        }

        String userId = jwtService.extractUserId(token);
        User user = userRepository.findById(java.util.UUID.fromString(userId))
                .filter(User::isActive)
                .orElseThrow(() -> new BusinessException("User not found", "USER_NOT_FOUND"));

        String newAccessToken  = jwtService.generateAccessToken(user);
        String newRefreshToken = jwtService.generateRefreshToken(user);

        AuthDtos.UserSummary summary = buildSummary(user, user.getTenant());

        AuthDtos.AuthResponse response = new AuthDtos.AuthResponse();
        response.setAccessToken(newAccessToken);
        response.setRefreshToken(newRefreshToken);
        response.setExpiresIn(900);
        response.setUser(summary);

        return response;
    }

    private AuthDtos.UserSummary buildSummary(User user, Tenant tenant) {
        AuthDtos.UserSummary summary = new AuthDtos.UserSummary();
        summary.setId(user.getId().toString());
        summary.setFullName(user.getFullName());
        summary.setPhone(user.getPhone());
        summary.setRole(user.getRole().name());
        summary.setTenantId(tenant.getId().toString());
        summary.setTenantName(tenant.getName());
        summary.setTenantStatus(tenant.getStatus().name());
        summary.setPlan(tenant.getPlan() != null ? tenant.getPlan().name() : "TRIAL");
        summary.setProfileImageUrl(user.getProfileImageUrl());

        if (user.getRole() == User.UserRole.ADMIN || user.getRole() == User.UserRole.SUPER_ADMIN) {
            summary.setRoleName(user.getRole().name());
            summary.setPermissions(List.of("ALL"));
            summary.setFieldStaff(false);
        } else if (user.getCustomRole() != null) {
            summary.setRoleName(user.getCustomRole().getName());
            summary.setFieldStaff(user.getCustomRole().isFieldStaff());
            summary.setPermissions(user.getCustomRole().getPermissions().stream()
                    .map(Permission::name)
                    .sorted()
                    .toList());
        } else {
            summary.setRoleName("No Role");
            summary.setPermissions(List.of());
            summary.setFieldStaff(false);
        }

        return summary;
    }
}
