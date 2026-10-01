package com.stockez.api.module.user.repository;

import com.stockez.api.module.role.entity.Permission;
import com.stockez.api.module.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByPhoneAndTenant_IdAndActiveTrue(String phone, UUID tenantId);

    List<User> findAllByPhoneAndActiveTrue(String phone);

    Optional<User> findByPhoneAndActiveTrue(String phone);

    Optional<User> findByEmailAndTenant_IdAndActiveTrue(String email, UUID tenantId);

    Optional<User> findByEmailAndActiveTrue(String email);

    Optional<User> findByIdAndTenantId(UUID userId, UUID tenantId);

    boolean existsByPhoneAndActiveTrue(String phone);

    boolean existsByPhoneAndActiveTrueAndTenant_IdNot(String phone, UUID tenantId);

    org.springframework.data.domain.Page<User> findByTenantIdAndActiveTrueAndRoleNot(UUID tenantId, User.UserRole excludeRole, org.springframework.data.domain.Pageable pageable);
    
    org.springframework.data.domain.Page<User> findByTenantIdAndRoleNot(UUID tenantId, User.UserRole excludeRole, org.springframework.data.domain.Pageable pageable);

    long countByTenantIdAndActiveTrue(UUID tenantId);

    long countByTenantIdAndActiveTrueAndRoleNotIn(UUID tenantId, java.util.List<User.UserRole> excludeRoles);

    Optional<User> findFirstByTenantIdAndRoleAndActiveTrue(UUID tenantId, User.UserRole role);

    long countByTenantIdAndRoleAndActiveTrue(UUID tenantId, User.UserRole role);

    long countByCustomRoleIdAndTenantId(UUID customRoleId, UUID tenantId);

    java.util.List<User> findByCustomRoleIdAndTenantId(UUID customRoleId, UUID tenantId);

    java.util.List<User> findByTenantIdAndRoleAndActiveTrue(UUID tenantId, User.UserRole role);

    @Query("SELECT u FROM User u WHERE u.tenant.id = :tenantId AND u.active = true AND u.customRole IS NOT NULL AND :permission MEMBER OF u.customRole.permissions")
    java.util.List<User> findByTenantIdAndPermissionAndActiveTrue(@Param("tenantId") UUID tenantId, @Param("permission") Permission permission);
}
