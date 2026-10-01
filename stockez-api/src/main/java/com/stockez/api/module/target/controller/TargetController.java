package com.stockez.api.module.target.controller;

import com.stockez.api.module.target.dto.TargetDtos;
import com.stockez.api.module.target.service.TargetService;
import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/targets")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Targets", description = "Sales target management and achievement tracking")
public class TargetController {

    private final TargetService targetService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Create or update a monthly sales target for a salesperson")
    public ResponseEntity<ApiResponse<TargetDtos.TargetResponse>> upsertTarget(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @Valid @RequestBody TargetDtos.UpsertTargetRequest request) {
        TargetDtos.TargetResponse response = targetService.upsertTarget(tenantId, request);
        return ResponseEntity.status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Target saved successfully"));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('INCENTIVES_VIEW','INCENTIVES_MANAGE')")
    @Operation(summary = "List all sales targets with achievement for a given month/year")
    public ResponseEntity<ApiResponse<TargetDtos.TargetListResponse>> listTargets(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam int month,
            @RequestParam int year) {
        return ResponseEntity.ok(ApiResponse.success(targetService.listTargets(tenantId, month, year)));
    }
}
