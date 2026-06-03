package com.stockez.api.module.audit.controller;

import com.stockez.api.module.audit.entity.AuditLog;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.common.response.ApiResponse;
import com.stockez.common.response.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
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
    @Operation(summary = "Get audit history for a specific entity")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getHistory(
            @PathVariable String entityType,
            @PathVariable UUID entityId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        List<AuditLog> logs = auditService.getHistory(tenantId, entityType.toUpperCase(), entityId);
        List<Map<String, Object>> result = logs.stream().map(this::toMap).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/report")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Paginated audit log report with filters")
    public ResponseEntity<ApiResponse<PagedResponse<Map<String, Object>>>> report(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String performedBy,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        Instant fromInstant = from != null ? from.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        Instant toInstant   = to   != null ? to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;

        Page<AuditLog> result = auditService.getReport(
                tenantId, entityType, performedBy, action, fromInstant, toInstant,
                PageRequest.of(page, size));

        Page<Map<String, Object>> mapped = result.map(this::toMap);
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(mapped)));
    }

    private Map<String, Object> toMap(AuditLog l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("entityType", l.getEntityType());
        m.put("entityId", l.getEntityId());
        m.put("action", l.getAction());
        m.put("description", l.getDescription());
        m.put("performedBy", l.getPerformedBy());
        m.put("performedAt", l.getPerformedAt());
        return m;
    }

    private <T> PagedResponse<T> toPagedResponse(Page<T> page) {
        return PagedResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
