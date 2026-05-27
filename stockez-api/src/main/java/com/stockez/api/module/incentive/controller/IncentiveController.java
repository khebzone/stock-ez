package com.stockez.api.module.incentive.controller;

import com.stockez.api.module.incentive.dto.IncentiveDtos;
import com.stockez.api.module.incentive.service.IncentiveService;
import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/incentives")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Incentives", description = "Brand-wise targets and incentive management")
public class IncentiveController {

    private final IncentiveService incentiveService;

    // ── Brands ────────────────────────────────────────────────────────────────

    @GetMapping("/brands")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get distinct product brands for the tenant [ADMIN]")
    public ResponseEntity<ApiResponse<List<String>>> getBrands(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getDistinctBrands(tenantId)));
    }

    // ── Targets ────────────────────────────────────────────────────────────────

    @PostMapping("/targets")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create or update a brand target for a salesperson [ADMIN]")
    public ResponseEntity<ApiResponse<IncentiveDtos.BrandTargetRow>> saveTarget(
            @Valid @RequestBody IncentiveDtos.SaveTargetRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.saveTarget(request, tenantId), "Target saved"));
    }

    @GetMapping("/targets")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    @Operation(summary = "Get brand targets with live achievement for a month [ADMIN/SALES]")
    public ResponseEntity<ApiResponse<IncentiveDtos.TargetSummary>> getTargets(
            @RequestParam int month,
            @RequestParam int year,
            @RequestParam(required = false) UUID salesPersonId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            org.springframework.security.core.Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        UUID filterPerson = isAdmin ? salesPersonId : userId;
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getTargetsSummary(tenantId, month, year, filterPerson)));
    }

    // ── Slabs ─────────────────────────────────────────────────────────────────

    @GetMapping("/slabs")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    @Operation(summary = "Get all incentive slabs grouped by brand [ADMIN/SALES]")
    public ResponseEntity<ApiResponse<List<IncentiveDtos.BrandSlabSummary>>> getAllSlabs(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getAllSlabs(tenantId)));
    }

    @GetMapping("/slabs/{brand}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    @Operation(summary = "Get incentive slabs for a specific brand [ADMIN/SALES]")
    public ResponseEntity<ApiResponse<List<IncentiveDtos.IncentiveSlabResponse>>> getSlabsForBrand(
            @PathVariable String brand,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getSlabsForBrand(tenantId, brand)));
    }

    @PostMapping("/slabs")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Replace all incentive slabs for a brand [ADMIN]")
    public ResponseEntity<ApiResponse<List<IncentiveDtos.IncentiveSlabResponse>>> saveSlabs(
            @Valid @RequestBody IncentiveDtos.SaveSlabsRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.saveSlabs(request, tenantId), "Slabs saved"));
    }

    // ── Credits ────────────────────────────────────────────────────────────────

    @PostMapping("/calculate")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Calculate and create incentive credit records for a month [ADMIN]")
    public ResponseEntity<ApiResponse<IncentiveDtos.CreditSummary>> calculate(
            @Valid @RequestBody IncentiveDtos.CreditRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.calculateAndCredit(request, tenantId), "Incentives calculated"));
    }

    @GetMapping("/credits")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get incentive credit summary for a month [ADMIN]")
    public ResponseEntity<ApiResponse<IncentiveDtos.CreditSummary>> getCredits(
            @RequestParam int month,
            @RequestParam int year,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getCreditSummary(tenantId, month, year)));
    }

    @PostMapping("/credits/{id}/mark-credited")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Mark an incentive credit as formally credited [ADMIN]")
    public ResponseEntity<ApiResponse<IncentiveDtos.IncentiveCreditResponse>> markCredited(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.markCredited(id, tenantId), "Incentive credited"));
    }

    // ── Employee view ─────────────────────────────────────────────────────────

    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('SALES','ADMIN')")
    @Operation(summary = "Get my incentive progress for a month [SALES]")
    public ResponseEntity<ApiResponse<IncentiveDtos.MyIncentiveView>> getMyIncentives(
            @RequestParam int month,
            @RequestParam int year,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            org.springframework.security.core.Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        UUID viewUserId = isAdmin ? userId : userId;
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getMyIncentives(tenantId, viewUserId, month, year)));
    }
}
