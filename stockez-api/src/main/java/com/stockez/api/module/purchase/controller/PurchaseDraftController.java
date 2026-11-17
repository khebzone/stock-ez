package com.stockez.api.module.purchase.controller;

import com.stockez.api.module.purchase.dto.PurchaseDraftDtos;
import com.stockez.api.module.purchase.service.PurchaseDraftService;
import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/purchase-drafts")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Purchase drafts", description = "Unfinished purchase entries saved to continue later")
@PreAuthorize("hasRole('ADMIN') or hasAuthority('PURCHASES_CREATE')")
public class PurchaseDraftController {

    private final PurchaseDraftService draftService;

    @GetMapping
    @Operation(summary = "List purchase drafts")
    public ResponseEntity<ApiResponse<List<PurchaseDraftDtos.DraftResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(draftService.list(tenantId)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a purchase draft with its saved screen")
    public ResponseEntity<ApiResponse<PurchaseDraftDtos.DraftResponse>> get(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(draftService.get(id, tenantId)));
    }

    @PostMapping
    @Operation(summary = "Save a new purchase draft")
    public ResponseEntity<ApiResponse<PurchaseDraftDtos.DraftResponse>> create(
            @Valid @RequestBody PurchaseDraftDtos.SaveDraftRequest req,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(draftService.create(req, userId, tenantId), "Draft saved"));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a purchase draft")
    public ResponseEntity<ApiResponse<PurchaseDraftDtos.DraftResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody PurchaseDraftDtos.SaveDraftRequest req,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(draftService.update(id, req, userId, tenantId), "Draft saved"));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a purchase draft")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        draftService.delete(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Draft deleted"));
    }
}
