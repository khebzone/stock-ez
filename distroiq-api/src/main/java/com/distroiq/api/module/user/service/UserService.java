package com.distroiq.api.module.user.service;

import com.distroiq.api.module.user.dto.UserDtos;
import com.distroiq.api.module.user.entity.User;
import com.distroiq.api.module.user.repository.UserRepository;
import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.tenant.repository.TenantRepository;
import com.distroiq.api.module.audit.service.AuditService;
import com.distroiq.common.exception.BusinessException;
import com.distroiq.common.exception.ResourceNotFoundException;
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
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserDtos.UserResponse createUser(UserDtos.CreateUserRequest request, UUID tenantId, User.UserRole creatorRole) {
        if (request.getRole() == User.UserRole.SUPER_ADMIN) {
            throw new BusinessException("Cannot create SUPER_ADMIN via this endpoint", "FORBIDDEN_ROLE");
        }
        if (userRepository.existsByPhoneAndTenantId(request.getPhone(), tenantId)) {
            throw new BusinessException("Phone number already registered in this organization", "PHONE_EXISTS");
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        User user = User.builder()
                .tenant(tenant)
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .salary(request.getSalary())
                .employmentType(request.getEmploymentType())
                .mustChangePassword(false)
                .build();

        User saved = userRepository.save(user);
        auditService.record(tenantId, "USER", saved.getId(), "CREATED",
                "User " + saved.getFullName() + " (" + saved.getRole().name() + ") created");
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
        // Never expose SUPER_ADMIN on the tenant's user management page — it's a platform-level account
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
        if (request.getRole() != null && request.getRole() != User.UserRole.SUPER_ADMIN) {
            user.setRole(request.getRole());
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

    public void deactivateUser(UUID id, UUID tenantId) {
        User user = userRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", id.toString()));
        user.setActive(false);
        userRepository.save(user);
        auditService.record(tenantId, "USER", user.getId(), "DEACTIVATED",
                "User " + user.getFullName() + " deactivated");
    }

    public void reactivateUser(UUID id, UUID tenantId) {
        User user = userRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", id.toString()));
        user.setActive(true);
        userRepository.save(user);
        auditService.record(tenantId, "USER", user.getId(), "REACTIVATED",
                "User " + user.getFullName() + " reactivated");
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
        res.setRole(user.getRole());
        res.setProfileImageUrl(user.getProfileImageUrl());
        res.setActive(user.isActive());
        res.setSalary(user.getSalary());
        res.setEmploymentType(user.getEmploymentType());
        res.setCreatedAt(user.getCreatedAt());
        return res;
    }
}
