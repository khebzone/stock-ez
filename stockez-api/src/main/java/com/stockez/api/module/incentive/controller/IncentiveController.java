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

    @GetMapping("/brands")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Get distinct product brands for the tenant")
    public ResponseEntity<ApiResponse<List<IncentiveDtos.BrandOption>>> getBrands(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getDistinctBrands(tenantId)));
    }

    @PostMapping("/targets")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Create or update a brand target for a salesperson")
    public ResponseEntity<ApiResponse<IncentiveDtos.BrandTargetRow>> saveTarget(
            @Valid @RequestBody IncentiveDtos.SaveTargetRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.saveTarget(request, tenantId), "Target saved"));
    }

    @GetMapping("/targets")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_VIEW')")
    @Operation(summary = "Get brand targets with live achievement for a month")
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

    @GetMapping("/slabs")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_VIEW')")
    @Operation(summary = "Get all incentive slabs grouped by brand")
    public ResponseEntity<ApiResponse<List<IncentiveDtos.BrandSlabSummary>>> getAllSlabs(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getAllSlabs(tenantId)));
    }

    @GetMapping("/slabs/{brand}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_VIEW')")
    @Operation(summary = "Get incentive slabs for a specific brand")
    public ResponseEntity<ApiResponse<List<IncentiveDtos.IncentiveSlabResponse>>> getSlabsForBrand(
            @PathVariable String brand,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getSlabsForBrand(tenantId, brand)));
    }

    @PostMapping("/slabs")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Replace all incentive slabs for a brand")
    public ResponseEntity<ApiResponse<List<IncentiveDtos.IncentiveSlabResponse>>> saveSlabs(
            @Valid @RequestBody IncentiveDtos.SaveSlabsRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.saveSlabs(request, tenantId), "Slabs saved"));
    }

    @PostMapping("/calculate")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Calculate and create incentive credit records for a month")
    public ResponseEntity<ApiResponse<IncentiveDtos.CreditSummary>> calculate(
            @Valid @RequestBody IncentiveDtos.CreditRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.calculateAndCredit(request, tenantId), "Incentives calculated"));
    }

    @GetMapping("/credits")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Get incentive credit summary for a month")
    public ResponseEntity<ApiResponse<IncentiveDtos.CreditSummary>> getCredits(
            @RequestParam int month,
            @RequestParam int year,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getCreditSummary(tenantId, month, year)));
    }

    @PostMapping("/credits/{id}/mark-credited")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Mark an incentive credit as formally credited")
    public ResponseEntity<ApiResponse<IncentiveDtos.IncentiveCreditResponse>> markCredited(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.markCredited(id, tenantId), "Incentive credited"));
    }

    // ── Collection Targets ────────────────────────────────────────────────────

    @PostMapping("/collection/targets")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Create or update a collection target for a salesperson")
    public ResponseEntity<ApiResponse<IncentiveDtos.CollectionTargetRow>> saveCollectionTarget(
            @Valid @RequestBody IncentiveDtos.SaveCollectionTargetRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.saveCollectionTarget(request, tenantId), "Target saved"));
    }

    @GetMapping("/collection/targets")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_VIEW')")
    @Operation(summary = "Get collection targets with live achievement for a month")
    public ResponseEntity<ApiResponse<IncentiveDtos.CollectionTargetSummary>> getCollectionTargets(
            @RequestParam int month,
            @RequestParam int year,
            @RequestParam(required = false) UUID salesPersonId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            org.springframework.security.core.Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        UUID filterPerson = isAdmin ? salesPersonId : null;
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getCollectionTargetsSummary(tenantId, month, year, filterPerson)));
    }

    @GetMapping("/collection/slabs")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_VIEW')")
    @Operation(summary = "Get collection incentive slabs")
    public ResponseEntity<ApiResponse<List<IncentiveDtos.CollectionSlabResponse>>> getCollectionSlabs(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getCollectionSlabs(tenantId)));
    }

    @PostMapping("/collection/slabs")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Replace all collection incentive slabs")
    public ResponseEntity<ApiResponse<List<IncentiveDtos.CollectionSlabResponse>>> saveCollectionSlabs(
            @Valid @RequestBody IncentiveDtos.SaveCollectionSlabsRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.saveCollectionSlabs(request, tenantId), "Slabs saved"));
    }

    @PostMapping("/collection/calculate")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Calculate and create collection incentive credit records for a month")
    public ResponseEntity<ApiResponse<IncentiveDtos.CollectionCreditSummary>> calculateCollections(
            @Valid @RequestBody IncentiveDtos.CreditRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.calculateAndCreditCollections(request, tenantId), "Collection incentives calculated"));
    }

    @GetMapping("/collection/credits")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Get collection incentive credit summary for a month")
    public ResponseEntity<ApiResponse<IncentiveDtos.CollectionCreditSummary>> getCollectionCredits(
            @RequestParam int month,
            @RequestParam int year,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.getCollectionCreditSummary(tenantId, month, year)));
    }

    @PostMapping("/collection/credits/{id}/mark-credited")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_MANAGE')")
    @Operation(summary = "Mark a collection incentive credit as formally credited")
    public ResponseEntity<ApiResponse<IncentiveDtos.CollectionCreditResponse>> markCollectionCredited(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(incentiveService.markCollectionCredited(id, tenantId), "Collection incentive credited"));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INCENTIVES_VIEW')")
    @Operation(summary = "Get my incentive progress for a month")
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
