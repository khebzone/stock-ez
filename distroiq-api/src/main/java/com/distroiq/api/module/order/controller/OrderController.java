package com.distroiq.api.module.order.controller;

import com.distroiq.api.module.order.dto.OrderDtos;
import com.distroiq.api.module.order.entity.Order;
import com.distroiq.api.module.order.service.OrderService;
import com.distroiq.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Orders", description = "Sales order management and lifecycle")
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    @PreAuthorize("hasRole('SALES')")
    @Operation(summary = "Create a new order [SALES]")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> create(
            @Valid @RequestBody OrderDtos.CreateOrderRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(orderService.createOrder(request, userId, tenantId), "Order submitted"));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','INVOICE','WAREHOUSE','DELIVERY')")
    @Operation(summary = "List orders with optional filters [ADMIN/INVOICE/WAREHOUSE/DELIVERY]")
    public ResponseEntity<ApiResponse<?>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) Order.OrderStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.getOrdersByStatus(tenantId, status, from, to,
                        PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','INVOICE','WAREHOUSE','DELIVERY','SALES')")
    @Operation(summary = "Get order by ID")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> getById(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getOrderById(id, tenantId)));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('INVOICE')")
    @Operation(summary = "Approve order and generate bill [INVOICE]")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> approve(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.approveOrder(id, userId, tenantId), "Order approved"));
    }

    @PostMapping("/{id}/start-preparing")
    @PreAuthorize("hasRole('WAREHOUSE')")
    @Operation(summary = "Start picking items [WAREHOUSE]")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> startPreparing(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.startPreparing(id, tenantId), "Order preparation started"));
    }

    @PostMapping("/{id}/verify-items")
    @PreAuthorize("hasRole('WAREHOUSE')")
    @Operation(summary = "Verify item quantities [WAREHOUSE]")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> verifyItems(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.VerifyItemsRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.verifyItems(id, request, tenantId), "Items verified"));
    }

    @PostMapping("/{id}/mark-prepared")
    @PreAuthorize("hasRole('WAREHOUSE')")
    @Operation(summary = "Mark order as prepared [WAREHOUSE]")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> markPrepared(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.markPrepared(id, tenantId), "Order prepared"));
    }

    @PostMapping("/{id}/assign-delivery")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Assign delivery person [ADMIN]")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> assignDelivery(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.AssignDeliveryRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.assignDelivery(id, request, tenantId), "Delivery person assigned"));
    }

    @PostMapping("/{id}/dispatch")
    @PreAuthorize("hasRole('DELIVERY')")
    @Operation(summary = "Mark order dispatched [DELIVERY]")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> dispatch(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.markDispatched(id, tenantId), "Order dispatched"));
    }

    @PostMapping("/{id}/deliver")
    @PreAuthorize("hasRole('DELIVERY')")
    @Operation(summary = "Mark order delivered [DELIVERY]")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> deliver(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.markDelivered(id, tenantId), "Order delivered"));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','INVOICE')")
    @Operation(summary = "Cancel/reject order [ADMIN/SALES/INVOICE]")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> cancel(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.UpdateStatusRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.cancelOrder(id, request.getNotes(), tenantId), "Order cancelled"));
    }

    @GetMapping("/my-orders")
    @PreAuthorize("hasRole('SALES')")
    @Operation(summary = "Today's orders for sales person [SALES]")
    public ResponseEntity<ApiResponse<List<OrderDtos.OrderResponse>>> myOrders(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getMyOrders(userId, tenantId)));
    }

    @GetMapping("/route-picklist")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Get consolidated pick list grouped by route for a given date [ADMIN/WAREHOUSE]")
    public ResponseEntity<ApiResponse<List<OrderDtos.RoutePicklistResponse>>> routePicklist(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getRoutePicklist(tenantId, date)));
    }

    @PostMapping("/route-start-preparing")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Batch-start preparing all APPROVED orders for a route on a date [ADMIN/WAREHOUSE]")
    public ResponseEntity<ApiResponse<String>> routeStartPreparing(
            @Valid @RequestBody OrderDtos.BatchRouteRequest req,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        orderService.routeStartPreparing(tenantId, req.getRouteId(), req.getDate());
        return ResponseEntity.ok(ApiResponse.success("OK", "Preparation started for route"));
    }

    @PostMapping("/route-mark-prepared")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Batch-mark all PREPARING orders for a route as PREPARED [ADMIN/WAREHOUSE]")
    public ResponseEntity<ApiResponse<String>> routeMarkPrepared(
            @Valid @RequestBody OrderDtos.BatchRouteRequest req,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        orderService.routeMarkPrepared(tenantId, req.getRouteId(), req.getDate());
        return ResponseEntity.ok(ApiResponse.success("OK", "All orders marked prepared"));
    }

    @GetMapping("/my-deliveries")
    @PreAuthorize("hasRole('DELIVERY')")
    @Operation(summary = "Today's deliveries for delivery person [DELIVERY]")
    public ResponseEntity<ApiResponse<List<OrderDtos.OrderResponse>>> myDeliveries(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getMyDeliveries(userId, tenantId)));
    }
}
