package com.distroiq.api.module.dayclosure.controller;

import com.distroiq.api.module.dayclosure.dto.DayClosureDtos;
import com.distroiq.api.module.dayclosure.service.DayClosureService;
import com.distroiq.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/day-closure")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Day Closure", description = "Daily cash counter closing — live counter, close day, history")
public class DayClosureController {

    private final DayClosureService dayClosureService;

    // ─── 1. Today's live counter ──────────────────────────────────────────────

    @GetMapping("/today")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Get today's live cash counter with per-collector breakdown [ADMIN/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<DayClosureDtos.TodayCounterResponse>> getTodayCounter(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(dayClosureService.getTodayCounter(tenantId)));
    }

    // ─── 2. Close the day ─────────────────────────────────────────────────────

    @PostMapping("/close")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Close today's cash counter — enter physical cash count [ADMIN/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<DayClosureDtos.DayClosureResponse>> closeDay(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @Valid @RequestBody DayClosureDtos.CloseDayRequest req) {
        String closedByName = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(ApiResponse.success(
                dayClosureService.closeDay(tenantId, req, closedByName),
                "Day closed successfully"));
    }

    // ─── 3. History ───────────────────────────────────────────────────────────

    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "List all past day closures in descending date order [ADMIN/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<List<DayClosureDtos.DayClosureResponse>>> getHistory(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(dayClosureService.getHistory(tenantId)));
    }
}
