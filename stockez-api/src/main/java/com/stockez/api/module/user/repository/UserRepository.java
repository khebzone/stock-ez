package com.stockez.api.module.user.repository;

import com.stockez.api.module.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByPhoneAndActiveTrue(String phone);

    Optional<User> findByEmailAndActiveTrue(String email);

    Optional<User> findByIdAndTenantId(UUID userId, UUID tenantId);

    boolean existsByPhoneAndTenantId(String phone, UUID tenantId);

    org.springframework.data.domain.Page<User> findByTenantIdAndActiveTrueAndRoleNot(UUID tenantId, User.UserRole excludeRole, org.springframework.data.domain.Pageable pageable);
    
    org.springframework.data.domain.Page<User> findByTenantIdAndRoleNot(UUID tenantId, User.UserRole excludeRole, org.springframework.data.domain.Pageable pageable);

    long countByTenantIdAndActiveTrue(UUID tenantId);

    long countByTenantIdAndActiveTrueAndRoleNotIn(UUID tenantId, java.util.List<User.UserRole> excludeRoles);

    Optional<User> findFirstByTenantIdAndRoleAndActiveTrue(UUID tenantId, User.UserRole role);

    long countByTenantIdAndRoleAndActiveTrue(UUID tenantId, User.UserRole role);

    long countByCustomRoleIdAndTenantId(UUID customRoleId, UUID tenantId);

    java.util.List<User> findByCustomRoleIdAndTenantId(UUID customRoleId, UUID tenantId);
}
