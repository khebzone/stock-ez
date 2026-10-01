package com.stockez.api.module.role.service;

import com.stockez.api.module.role.dto.CustomRoleDtos;
import com.stockez.api.module.role.entity.CustomRole;
import com.stockez.api.module.role.repository.CustomRoleRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class CustomRoleService {

    private final CustomRoleRepository roleRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    public CustomRoleDtos.RoleResponse createRole(CustomRoleDtos.CreateRoleRequest request, UUID tenantId) {
        if (roleRepository.existsByNameAndTenantId(request.getName(), tenantId)) {
            throw new BusinessException("A role with this name already exists", "ROLE_NAME_EXISTS");
        }
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        CustomRole role = CustomRole.builder()
                .tenant(tenant)
                .name(request.getName())
                .fieldStaff(request.isFieldStaff())
                .permissions(request.getPermissions())
                .build();

        return toResponse(roleRepository.save(role), tenantId);
    }

    @Transactional(readOnly = true)
    public List<CustomRoleDtos.RoleResponse> getAllRoles(UUID tenantId) {
        return roleRepository.findByTenantIdOrderByNameAsc(tenantId)
                .stream()
                .map(r -> toResponse(r, tenantId))
                .toList();
    }

    @Transactional(readOnly = true)
    public CustomRoleDtos.RoleResponse getRoleById(UUID id, UUID tenantId) {
        CustomRole role = roleRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id.toString()));
        return toResponse(role, tenantId);
    }

    public CustomRoleDtos.RoleResponse updateRole(UUID id, CustomRoleDtos.UpdateRoleRequest request, UUID tenantId) {
        CustomRole role = roleRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id.toString()));

        if (roleRepository.existsByNameAndTenantIdAndIdNot(request.getName(), tenantId, id)) {
            throw new BusinessException("A role with this name already exists", "ROLE_NAME_EXISTS");
        }

        role.setName(request.getName());
        role.setFieldStaff(request.isFieldStaff());
        role.setPermissions(request.getPermissions());
        return toResponse(roleRepository.save(role), tenantId);
    }

    public void deleteRole(UUID id, UUID tenantId) {
        CustomRole role = roleRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id.toString()));

        long userCount = userRepository.countByCustomRoleIdAndTenantId(id, tenantId);
        if (userCount > 0) {
            throw new BusinessException(
                    "Cannot delete role — " + userCount + " user(s) are assigned to it. Reassign them first.",
                    "ROLE_IN_USE");
        }
        roleRepository.delete(role);
    }

    @Transactional(readOnly = true)
    public List<CustomRoleDtos.RoleSummary> getRoleSummaries(UUID tenantId) {
        return roleRepository.findByTenantIdOrderByNameAsc(tenantId)
                .stream()
                .map(this::toSummary)
                .toList();
    }

    private CustomRoleDtos.RoleResponse toResponse(CustomRole role, UUID tenantId) {
        CustomRoleDtos.RoleResponse res = new CustomRoleDtos.RoleResponse();
        res.setId(role.getId());
        res.setName(role.getName());
        res.setFieldStaff(role.isFieldStaff());
        res.setPermissions(role.getPermissions());
        res.setUserCount(userRepository.countByCustomRoleIdAndTenantId(role.getId(), tenantId));
        res.setCreatedAt(role.getCreatedAt());
        return res;
    }

    private CustomRoleDtos.RoleSummary toSummary(CustomRole role) {
        CustomRoleDtos.RoleSummary s = new CustomRoleDtos.RoleSummary();
        s.setId(role.getId());
        s.setName(role.getName());
        s.setFieldStaff(role.isFieldStaff());
        s.setPermissions(role.getPermissions());
        return s;
    }
}
