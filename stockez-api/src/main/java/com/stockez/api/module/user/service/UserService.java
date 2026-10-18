package com.stockez.api.module.user.service;

import com.stockez.api.module.role.entity.CustomRole;
import com.stockez.api.module.role.repository.CustomRoleRepository;
import com.stockez.api.module.user.dto.UserDtos;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final CustomRoleRepository customRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserDtos.UserResponse createUser(UserDtos.CreateUserRequest request, UUID tenantId) {
        if (userRepository.existsByPhoneAndTenant_IdAndActiveTrue(request.getPhone(), tenantId)) {
            throw new BusinessException("Phone number is already registered", "PHONE_EXISTS");
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        long staffCount = userRepository.countByTenantIdAndActiveTrueAndRoleNotIn(
                tenantId, java.util.List.of(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN));
        if (staffCount >= tenant.getMaxUsers()) {
            throw new BusinessException(
                    "User limit reached (" + tenant.getMaxUsers() + " users). Upgrade your plan to add more.",
                    "USER_LIMIT_REACHED");
        }

        CustomRole customRole = null;
        if (request.getCustomRoleId() != null) {
            customRole = customRoleRepository.findByIdAndTenantId(request.getCustomRoleId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Role", request.getCustomRoleId().toString()));
        }

        User user = User.builder()
                .tenant(tenant)
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(User.UserRole.STAFF)
                .customRole(customRole)
                .salary(request.getSalary())
                .employmentType(request.getEmploymentType())
                .mustChangePassword(false)
                .build();

        User saved = userRepository.save(user);
        auditService.record(tenantId, "USER", saved.getId(), "CREATED",
                "User " + saved.getFullName() + " (" + (customRole != null ? customRole.getName() : "No role") + ") created");
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public UserDtos.UserResponse getUserById(UUID id, UUID tenantId) {
        User user = userRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", id.toString()));
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public Page<UserDtos.UserResponse> getAllUsers(UUID tenantId, boolean includeInactive, Pageable pageable) {
        if (includeInactive) {
            return userRepository.findByTenantIdAndRoleNot(tenantId, User.UserRole.SUPER_ADMIN, pageable).map(this::toResponse);
        }
        return userRepository.findByTenantIdAndActiveTrueAndRoleNot(tenantId, User.UserRole.SUPER_ADMIN, pageable).map(this::toResponse);
    }

    public UserDtos.UserResponse updateUser(UUID id, UserDtos.UpdateUserRequest request, UUID tenantId) {
        User user = userRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", id.toString()));

        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());

        if (request.getCustomRoleId() != null) {
            CustomRole customRole = customRoleRepository.findByIdAndTenantId(request.getCustomRoleId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Role", request.getCustomRoleId().toString()));
            user.setCustomRole(customRole);
        } else if (user.getRole() != User.UserRole.ADMIN && user.getRole() != User.UserRole.SUPER_ADMIN) {
            user.setCustomRole(null);
        }

        if (request.getActive() != null) {
            user.setActive(request.getActive());
        }
        user.setSalary(request.getSalary());
        user.setEmploymentType(request.getEmploymentType());
        if (request.getNewPassword() != null && !request.getNewPassword().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        }
        User saved = userRepository.save(user);
        auditService.record(tenantId, "USER", saved.getId(), "UPDATED",
                "User " + saved.getFullName() + " details updated");
        return toResponse(saved);
    }

    public void deactivateUser(UUID id, UUID tenantId, UUID requestingUserId) {
        if (id.equals(requestingUserId)) {
            throw new BusinessException("You cannot deactivate your own account", "SELF_DEACTIVATION");
        }
        User user = userRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", id.toString()));
        if (user.getRole() == User.UserRole.ADMIN) {
            long activeAdmins = userRepository.countByTenantIdAndRoleAndActiveTrue(tenantId, User.UserRole.ADMIN);
            if (activeAdmins <= 1) {
                throw new BusinessException("Cannot deactivate the last active admin account", "LAST_ADMIN");
            }
        }
        user.setActive(false);
        userRepository.save(user);
        auditService.record(tenantId, "USER", user.getId(), "DEACTIVATED",
                "User " + user.getFullName() + " deactivated");
    }

    public void reactivateUser(UUID id, UUID tenantId) {
        User user = userRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", id.toString()));
        if (user.getRole() == User.UserRole.STAFF) {
            Tenant tenant = tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
            long staffCount = userRepository.countByTenantIdAndActiveTrueAndRoleNotIn(
                    tenantId, java.util.List.of(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN));
            if (staffCount >= tenant.getMaxUsers()) {
                throw new BusinessException(
                        "User limit reached (" + tenant.getMaxUsers() + " users). Upgrade your plan to add more.",
                        "USER_LIMIT_REACHED");
            }
        }
        user.setActive(true);
        userRepository.save(user);
        auditService.record(tenantId, "USER", user.getId(), "REACTIVATED",
                "User " + user.getFullName() + " reactivated");
    }

    @Transactional(readOnly = true)
    public UserDtos.UserQuotaResponse getUserQuota(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        long staffCount = userRepository.countByTenantIdAndActiveTrueAndRoleNotIn(
                tenantId, java.util.List.of(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN));
        UserDtos.UserQuotaResponse res = new UserDtos.UserQuotaResponse();
        res.setCurrentCount(staffCount);
        res.setMaxUsers(tenant.getMaxUsers());
        res.setAtLimit(staffCount >= tenant.getMaxUsers());
        return res;
    }

    public void changePassword(UUID id, UserDtos.ChangePasswordRequest request, UUID tenantId) {
        User user = userRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", id.toString()));
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new BusinessException("Incorrect current password", "WRONG_PASSWORD");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setMustChangePassword(false);
        userRepository.save(user);
    }

    private UserDtos.UserResponse toResponse(User user) {
        UserDtos.UserResponse res = new UserDtos.UserResponse();
        res.setId(user.getId());
        res.setFullName(user.getFullName());
        res.setPhone(user.getPhone());
        res.setEmail(user.getEmail());
        if (user.getRole() == User.UserRole.ADMIN || user.getRole() == User.UserRole.SUPER_ADMIN) {
            res.setRoleName(user.getRole().name());
        } else if (user.getCustomRole() != null) {
            res.setRoleName(user.getCustomRole().getName());
            res.setCustomRoleId(user.getCustomRole().getId());
        }
        res.setProfileImageUrl(user.getProfileImageUrl());
        res.setActive(user.isActive());
        res.setSalary(user.getSalary());
        res.setEmploymentType(user.getEmploymentType());
        res.setCreatedAt(user.getCreatedAt());
        return res;
    }
}
