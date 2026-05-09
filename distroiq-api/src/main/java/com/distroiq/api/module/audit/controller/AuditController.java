package com.distroiq.api.module.audit.controller;

import com.distroiq.api.module.audit.entity.AuditLog;
import com.distroiq.api.module.audit.service.AuditService;
import com.distroiq.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Audit", description = "Audit history for all entities")
public class AuditController {

    private final AuditService auditService;

    @GetMapping("/{entityType}/{entityId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get audit history for any entity")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getHistory(
            @PathVariable String entityType,
            @PathVariable UUID entityId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        List<AuditLog> logs = auditService.getHistory(tenantId, entityType.toUpperCase(), entityId);
        List<Map<String, Object>> result = logs.stream().map(l -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", l.getId());
            m.put("action", l.getAction());
            m.put("description", l.getDescription());
            m.put("performedBy", l.getPerformedBy());
            m.put("performedAt", l.getPerformedAt());
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
