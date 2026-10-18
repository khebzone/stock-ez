package com.stockez.api.module.goodsreturn.controller;

import com.stockez.api.module.goodsreturn.dto.GoodsReturnDtos;
import com.stockez.api.module.goodsreturn.service.GoodsReturnService;
import com.stockez.common.response.ApiResponse;
import com.stockez.common.response.PagedResponse;
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

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/goods-returns")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Goods Returns", description = "Sales return, purchase return, and damage entry management")
public class GoodsReturnController {

    private final GoodsReturnService goodsReturnService;
    private final com.stockez.api.module.goodsreturn.service.DebitNotePdfService debitNotePdfService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('RETURNS_CREATE')")
    @Operation(summary = "Create goods return or damage entry — adjusts stock")
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

    @GetMapping("/my-history")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('RETURNS_CREATE')")
    @Operation(summary = "Returns filed by the calling user on a given date — own history, not company-wide view")
    public ResponseEntity<ApiResponse<List<GoodsReturnDtos.GoodsReturnResponse>>> myHistory(
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getMyReturns(tenantId, userId, date)));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('RETURNS_VIEW','RETURNS_APPROVE')")
    @Operation(summary = "List goods returns")
    public ResponseEntity<ApiResponse<PagedResponse<GoodsReturnDtos.GoodsReturnResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<GoodsReturnDtos.GoodsReturnResponse> result = goodsReturnService.listReturns(
                tenantId, PageRequest.of(page, size, Sort.by("returnDate").descending()));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('RETURNS_VIEW','RETURNS_APPROVE')")
    @Operation(summary = "Get goods return detail")
    public ResponseEntity<ApiResponse<GoodsReturnDtos.GoodsReturnResponse>> getById(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getReturn(id, tenantId)));
    }

    @GetMapping("/by-order/{orderId}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_VIEW','RETURNS_VIEW')")
    @Operation(summary = "List sales returns filed against an order")
    public ResponseEntity<ApiResponse<List<GoodsReturnDtos.GoodsReturnResponse>>> byOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getReturnsByOrder(orderId, tenantId)));
    }

    @GetMapping("/returned-qty/order/{orderId}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('RETURNS_VIEW','RETURNS_CREATE')")
    @Operation(summary = "Get already-returned qty per product for a sales order")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> getReturnedQtyByOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getReturnedQtyByOrder(orderId, tenantId)));
    }

    @GetMapping("/pending-refunds")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('RETURNS_VIEW')")
    @Operation(summary = "List sales returns with pending cash refunds")
    public ResponseEntity<ApiResponse<List<GoodsReturnDtos.GoodsReturnResponse>>> pendingRefunds(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getPendingRefunds(tenantId)));
    }

    @GetMapping("/customer-refunds")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_VIEW','RETURNS_VIEW')")
    @Operation(summary = "Customer refunds paid out on verified sales returns — tracking view")
    public ResponseEntity<ApiResponse<List<GoodsReturnDtos.GoodsReturnResponse>>> customerRefunds(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getCustomerRefunds(tenantId)));
    }

    @GetMapping("/supplier-claims")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_VIEW','RETURNS_VIEW')")
    @Operation(summary = "Purchase-return claims owed by suppliers — pending or received")
    public ResponseEntity<ApiResponse<List<GoodsReturnDtos.GoodsReturnResponse>>> supplierClaims(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getSupplierClaims(tenantId)));
    }

    @GetMapping("/pending-verification")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('RETURNS_APPROVE')")
    @Operation(summary = "List sales returns awaiting warehouse verification")
    public ResponseEntity<ApiResponse<List<GoodsReturnDtos.GoodsReturnResponse>>> pendingVerification(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getPendingVerification(tenantId)));
    }

    @GetMapping("/warehouse-history")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('RETURNS_VIEW','RETURNS_APPROVE','PICKLIST_VIEW')")
    @Operation(summary = "Customer sales returns already handled by the warehouse — verified or cancelled")
    public ResponseEntity<ApiResponse<List<GoodsReturnDtos.GoodsReturnResponse>>> warehouseHistory(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getWarehouseHistory(tenantId, from, to)));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('RETURNS_CREATE')")
    @Operation(summary = "Void a return that's still awaiting warehouse verification — nothing has moved yet, so this is a plain cancel")
    public ResponseEntity<ApiResponse<GoodsReturnDtos.GoodsReturnResponse>> cancel(
            @PathVariable UUID id,
            @Valid @RequestBody GoodsReturnDtos.CancelReturnRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(
                goodsReturnService.cancelReturn(id, request, userId, tenantId),
                "Return cancelled"));
    }

    @PostMapping("/{id}/verify-receipt")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('RETURNS_APPROVE')")
    @Operation(summary = "Warehouse physically verifies returned goods (per-line received qty) and restores stock")
    public ResponseEntity<ApiResponse<GoodsReturnDtos.GoodsReturnResponse>> verifyReceipt(
            @PathVariable UUID id,
            @Valid @RequestBody GoodsReturnDtos.VerifyReceiptRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(
                goodsReturnService.verifyWarehouseReceipt(id, request, userId, tenantId),
                "Warehouse receipt verified — stock restored"));
    }

    @GetMapping("/{id}/debit-note")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('RETURNS_VIEW','RETURNS_APPROVE','PURCHASES_VIEW')")
    @Operation(summary = "Printable debit note for a supplier return — data for the browser print view")
    public ResponseEntity<ApiResponse<GoodsReturnDtos.DebitNoteResponse>> debitNote(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(goodsReturnService.getDebitNote(id, tenantId)));
    }

    @GetMapping(value = "/{id}/debit-note/pdf", produces = org.springframework.http.MediaType.APPLICATION_PDF_VALUE)
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('RETURNS_VIEW','RETURNS_APPROVE','PURCHASES_VIEW')")
    @Operation(summary = "Download the debit note as a PDF")
    public ResponseEntity<byte[]> debitNotePdf(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) throws java.io.IOException {
        GoodsReturnDtos.DebitNoteResponse data = goodsReturnService.getDebitNote(id, tenantId);
        byte[] bytes = debitNotePdfService.generateBytes(data);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_TYPE,
                        org.springframework.http.MediaType.APPLICATION_PDF_VALUE)
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + data.getReturnNumber() + ".pdf\"")
                .body(bytes);
    }

    @PostMapping("/{id}/process-refund")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('RETURNS_CREATE')")
    @Operation(summary = "Process a pending refund — records negative payment and marks refund done")
    public ResponseEntity<ApiResponse<GoodsReturnDtos.GoodsReturnResponse>> processRefund(
            @PathVariable UUID id,
            @Valid @RequestBody GoodsReturnDtos.ProcessRefundRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(
                goodsReturnService.processRefund(id, request, userId, tenantId),
                "Refund processed successfully"));
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
