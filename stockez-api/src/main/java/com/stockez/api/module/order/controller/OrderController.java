package com.stockez.api.module.order.controller;

import com.stockez.api.module.order.dto.OrderDtos;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.service.OrderService;
import com.stockez.common.response.ApiResponse;
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
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_CREATE','INVOICE_APPROVE')")
    @Operation(summary = "Create a new order")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> create(
            @Valid @RequestBody OrderDtos.CreateOrderRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(orderService.createOrder(request, userId, tenantId), "Order submitted"));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_VIEW','INVOICE_VIEW','DELIVERY_VIEW','PICKLIST_VIEW')")
    @Operation(summary = "List orders with optional filters")
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
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_VIEW','INVOICE_VIEW','DELIVERY_VIEW','PICKLIST_VIEW')")
    @Operation(summary = "Get order by ID")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> getById(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getOrderById(id, tenantId)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_EDIT','INVOICE_APPROVE')")
    @Operation(summary = "Edit order items (only while SUBMITTED)")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.UpdateOrderRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.updateOrder(id, request, tenantId), "Order updated"));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INVOICE_APPROVE')")
    @Operation(summary = "Approve order and generate bill")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> approve(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.approveOrder(id, userId, tenantId), "Order approved"));
    }

    @PostMapping("/{id}/start-preparing")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_UPDATE')")
    @Operation(summary = "Start picking items")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> startPreparing(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.startPreparing(id, tenantId), "Order preparation started"));
    }

    @PostMapping("/{id}/verify-items")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_UPDATE')")
    @Operation(summary = "Verify item quantities")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> verifyItems(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.VerifyItemsRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.verifyItems(id, request, tenantId), "Items verified"));
    }

    @PostMapping("/{id}/mark-prepared")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_UPDATE')")
    @Operation(summary = "Mark order as prepared")
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
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DELIVERY_UPDATE')")
    @Operation(summary = "Mark order dispatched")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> dispatch(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.markDispatched(id, tenantId), "Order dispatched"));
    }

    @PostMapping("/{id}/deliver")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DELIVERY_UPDATE')")
    @Operation(summary = "Mark order delivered")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> deliver(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.markDelivered(id, tenantId), "Order delivered"));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_CANCEL','INVOICE_APPROVE')")
    @Operation(summary = "Cancel/reject order")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> cancel(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.UpdateStatusRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.cancelOrder(id, request.getNotes(), tenantId), "Order cancelled"));
    }

    @PostMapping("/counter-sale")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_CREATE','INVOICE_APPROVE')")
    @Operation(summary = "Create a counter sale — order immediately delivered with optional inline payment")
    public ResponseEntity<ApiResponse<OrderDtos.CounterSaleResponse>> counterSale(
            @Valid @RequestBody OrderDtos.CounterSaleRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(orderService.counterSale(request, userId, tenantId), "Counter sale completed"));
    }

    @GetMapping("/my-orders")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('ORDERS_VIEW')")
    @Operation(summary = "Today's orders for sales person")
    public ResponseEntity<ApiResponse<List<OrderDtos.OrderResponse>>> myOrders(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getMyOrders(userId, tenantId)));
    }

    @GetMapping("/route-picklist")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('STOCK_VIEW','PICKLIST_VIEW')")
    @Operation(summary = "Get consolidated pick list grouped by route for a given date")
    public ResponseEntity<ApiResponse<List<OrderDtos.RoutePicklistResponse>>> routePicklist(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            org.springframework.security.core.Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return ResponseEntity.ok(ApiResponse.success(orderService.getRoutePicklist(tenantId, date, isAdmin ? null : userId)));
    }

    @PostMapping("/route-start-preparing")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_UPDATE')")
    @Operation(summary = "Batch-start preparing all APPROVED orders for a route on a date")
    public ResponseEntity<ApiResponse<String>> routeStartPreparing(
            @Valid @RequestBody OrderDtos.BatchRouteRequest req,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        orderService.routeStartPreparing(tenantId, req.getRouteId(), req.getDate());
        return ResponseEntity.ok(ApiResponse.success("OK", "Preparation started for route"));
    }

    @PostMapping("/route-mark-prepared")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_UPDATE')")
    @Operation(summary = "Batch-mark all PREPARING orders for a route as PREPARED")
    public ResponseEntity<ApiResponse<String>> routeMarkPrepared(
            @Valid @RequestBody OrderDtos.BatchRouteRequest req,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        orderService.routeMarkPrepared(tenantId, req.getRouteId(), req.getDate());
        return ResponseEntity.ok(ApiResponse.success("OK", "All orders marked prepared"));
    }

    @GetMapping("/my-deliveries")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DELIVERY_VIEW')")
    @Operation(summary = "Today's deliveries for delivery person")
    public ResponseEntity<ApiResponse<List<OrderDtos.OrderResponse>>> myDeliveries(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getMyDeliveries(userId, tenantId)));
    }
}
