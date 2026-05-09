package com.distroiq.api.module.goodsreturn.controller;

import com.distroiq.api.module.goodsreturn.dto.GoodsReturnDtos;
import com.distroiq.api.module.goodsreturn.service.GoodsReturnService;
import com.distroiq.common.response.ApiResponse;
import com.distroiq.common.response.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/goods-returns")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Goods Returns", description = "Sales return, purchase return, and damage entry management")
public class GoodsReturnController {

    private final GoodsReturnService goodsReturnService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Create goods return or damage entry — adjusts stock [ADMIN/WAREHOUSE]")
    public ResponseEntity<ApiResponse<GoodsReturnDtos.GoodsReturnResponse>> create(
            @Valid @RequestBody GoodsReturnDtos.CreateGoodsReturnRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        goodsReturnService.createReturn(request, userId, tenantId),
                        "Goods return created successfully"));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE','ACCOUNTANT')")
    @Operation(summary = "List goods returns [ADMIN/WAREHOUSE/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<PagedResponse<GoodsReturnDtos.GoodsReturnResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<GoodsReturnDtos.GoodsReturnResponse> result = goodsReturnService.listReturns(
                tenantId, PageRequest.of(page, size, Sort.by("returnDate").descending()));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE','ACCOUNTANT')")
    @Operation(summary = "Get goods return detail [ADMIN/WAREHOUSE/ACCOUNTANT]")
    public ResponseEntity<ApiResponse<GoodsReturnDtos.GoodsReturnResponse>> getById(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getReturn(id, tenantId)));
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
