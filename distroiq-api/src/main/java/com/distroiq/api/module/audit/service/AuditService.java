package com.distroiq.api.module.audit.service;

import com.distroiq.api.module.audit.entity.AuditLog;
import com.distroiq.api.module.audit.repository.AuditLogRepository;
import com.distroiq.api.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public void record(UUID tenantId, String entityType, UUID entityId, String action, String description) {
        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId)
                .entityType(entityType)
                .entityId(entityId)
                .action(action)
                .description(description)
                .performedBy(resolveCurrentUser())
                .build());
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getHistory(UUID tenantId, String entityType, UUID entityId) {
        return auditLogRepository.findByTenantAndEntity(tenantId, entityType, entityId);
    }

    private String resolveCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return "SYSTEM";
        try {
            UUID userId = UUID.fromString(auth.getName());
            return userRepository.findById(userId).map(u -> u.getFullName()).orElse(auth.getName());
        } catch (Exception e) {
            return auth.getName();
        }
    }
}
