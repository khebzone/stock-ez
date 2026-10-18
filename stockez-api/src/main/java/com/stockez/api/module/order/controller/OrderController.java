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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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
            @RequestParam(required = false) UUID salesPersonId,
            @RequestParam(required = false) UUID routeId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.getOrdersByStatus(tenantId, status, from, to, salesPersonId, routeId, search,
                        PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))));
    }

    @GetMapping("/delivery-run/{allocationId}/invoices")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('GATE_PASS_VIEW','ORDERS_VIEW','DELIVERY_VIEW')")
    @Operation(summary = "All DISPATCHED invoices for a delivery run, for bulk printing after dispatch")
    public ResponseEntity<ApiResponse<List<OrderDtos.OrderResponse>>> deliveryRunInvoices(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID allocationId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getDeliveryRunInvoices(allocationId, tenantId)));
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_VIEW','INVOICE_VIEW','DELIVERY_VIEW')")
    @Operation(summary = "Get all orders without pagination, optional status filter")
    public ResponseEntity<ApiResponse<List<OrderDtos.OrderResponse>>> getAll(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam(required = false) Order.OrderStatus status,
            @RequestParam(required = false) Boolean deliveredByMe) {
        UUID deliveredByUserId = Boolean.TRUE.equals(deliveredByMe) ? userId : null;
        return ResponseEntity.ok(ApiResponse.success(orderService.getAllOrders(tenantId, status, deliveredByUserId)));
    }

    @GetMapping("/salespersons")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_VIEW','INVOICE_VIEW','PICKLIST_VIEW')")
    @Operation(summary = "Distinct salespersons that have orders, for the orders filter dropdown")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> salespersons(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getOrderSalespersons(tenantId)));
    }

    @GetMapping("/customer-last-prices")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_VIEW')")
    @Operation(summary = "Last billed unit price per product for a given customer")
    public ResponseEntity<ApiResponse<Map<UUID, List<OrderDtos.PriceEntry>>>> customerLastPrices(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam UUID customerId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getCustomerLastPrices(tenantId, customerId)));
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

    @PostMapping("/approve-batch")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('INVOICE_APPROVE')")
    @Operation(summary = "Approve every listed order in a single request instead of one call per order")
    public ResponseEntity<ApiResponse<OrderDtos.BulkApproveResponse>> approveBatch(
            @Valid @RequestBody OrderDtos.BulkApproveRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        OrderDtos.BulkApproveResponse response = orderService.approveOrders(request.getOrderIds(), userId, tenantId);
        return ResponseEntity.ok(ApiResponse.success(response, response.getApprovedCount() + " order(s) approved"));
    }

    @PostMapping("/{id}/start-packing")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_UPDATE')")
    @Operation(summary = "Start packing items")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> startPacking(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.startPacking(id, tenantId), "Packing started"));
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

    @PostMapping("/{id}/mark-packed")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_UPDATE')")
    @Operation(summary = "Mark order as packed")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> markPacked(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.markPacked(id, tenantId), "Order packed"));
    }

    @PostMapping("/{id}/assign-delivery")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_EDIT','DELIVERY_UPDATE')")
    @Operation(summary = "Assign delivery person")
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

    @PostMapping("/{id}/adjust-delivered-price")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin-only: correct price/discount on a DELIVERED order's existing lines (quantity locked)")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> adjustDeliveredPrice(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.AdjustDeliveredPriceRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.adjustDeliveredPrice(id, request, tenantId), "Price adjusted"));
    }

    @GetMapping("/warehouse-returns")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_VIEW')")
    @Operation(summary = "Get all open RETURN_TO_WAREHOUSE orders (task queue) grouped by delivery person")
    public ResponseEntity<ApiResponse<java.util.List<OrderDtos.WarehouseReturnGroup>>> getWarehouseReturns(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getWarehouseReturns(tenantId)));
    }

    @GetMapping("/warehouse-returns/history")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_VIEW')")
    @Operation(summary = "Undelivered orders already handled by the warehouse — confirmed back or cancelled")
    public ResponseEntity<ApiResponse<java.util.List<OrderDtos.WarehouseReturnHistoryRow>>> getWarehouseReturnHistory(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getWarehouseReturnHistory(tenantId, from, to)));
    }

    @PostMapping("/{id}/return-to-warehouse")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DELIVERY_UPDATE')")
    @Operation(summary = "Return dispatched order back to warehouse — genuine handback, done for the day")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> returnToWarehouse(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.returnToWarehouse(id, tenantId), "Order returned to warehouse"));
    }

    @PostMapping("/{id}/shop-closed")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DELIVERY_UPDATE')")
    @Operation(summary = "Shop closed / unavailable — order stays with the delivery person for a same-day retry")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> shopClosed(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.markShopClosed(id, tenantId), "Marked shop closed — retry anytime today"));
    }

    @PostMapping("/{id}/confirm-warehouse-return")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_EDIT','PICKLIST_UPDATE')")
    @Operation(summary = "Warehouse confirms receipt of returned order — moves back to PACKED for re-dispatch")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> confirmWarehouseReturn(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.ConfirmWarehouseReturnRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.confirmWarehouseReturn(id, request, tenantId, userId), "Order restocked — ready for re-dispatch"));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_CANCEL','INVOICE_APPROVE','PICKLIST_UPDATE')")
    @Operation(summary = "Cancel/reject order")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> cancel(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.UpdateStatusRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.cancelOrder(id, request.getNotes(), userId, tenantId), "Order cancelled"));
    }

    @PostMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin: manually change order status (workflow override — stock-neutral)")
    public ResponseEntity<ApiResponse<OrderDtos.OrderResponse>> changeStatus(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.ChangeOrderStatusRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.changeStatus(id, request.getStatus(), request.getNotes(), tenantId), "Order status updated"));
    }

    @DeleteMapping("/{id}/opening-balance")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('OPENING_BALANCE_DELETE')")
    @Operation(summary = "Delete a wrongly-imported opening balance entry")
    public ResponseEntity<ApiResponse<Void>> deleteOpeningBalance(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        orderService.deleteOpeningBalanceOrder(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Opening balance entry deleted"));
    }

    @PostMapping("/counter-sale")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('ORDERS_CREATE','INVOICE_APPROVE','COUNTER_SALE_VIEW')")
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

    @GetMapping("/route-picklist-history")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('STOCK_VIEW','PICKLIST_VIEW')")
    @Operation(summary = "Read-only pick list history for a route/date — stays visible even after orders move past PACKED")
    public ResponseEntity<ApiResponse<List<OrderDtos.RoutePicklistResponse>>> routePicklistHistory(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            org.springframework.security.core.Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return ResponseEntity.ok(ApiResponse.success(orderService.getRoutePicklistHistory(tenantId, date, isAdmin ? null : userId)));
    }

    @GetMapping("/my-warehouse-tasks")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_VIEW')")
    @Operation(summary = "Get picklist for the calling user's allocated route only — always filters by gate pass, ignores admin role")
    public ResponseEntity<ApiResponse<List<OrderDtos.RoutePicklistResponse>>> myWarehouseTasks(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getRoutePicklist(tenantId, date, userId)));
    }

    @PostMapping("/route-start-packing")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_UPDATE')")
    @Operation(summary = "Batch-start packing all APPROVED orders for a route on a date")
    public ResponseEntity<ApiResponse<String>> routeStartPacking(
            @Valid @RequestBody OrderDtos.BatchRouteRequest req,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        orderService.routeStartPacking(tenantId, req.getRouteId(), req.getDate());
        return ResponseEntity.ok(ApiResponse.success("OK", "Packing started for route"));
    }

    @PostMapping("/route-mark-packed")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PICKLIST_UPDATE')")
    @Operation(summary = "Batch-mark all PACKING orders for a route as PACKED")
    public ResponseEntity<ApiResponse<String>> routeMarkPacked(
            @Valid @RequestBody OrderDtos.BatchRouteRequest req,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        orderService.routeMarkPacked(tenantId, req.getRouteId(), req.getDate());
        return ResponseEntity.ok(ApiResponse.success("OK", "All orders marked packed"));
    }

    @GetMapping("/my-deliveries")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DELIVERY_VIEW')")
    @Operation(summary = "Today's deliveries for delivery person")
    public ResponseEntity<ApiResponse<List<OrderDtos.OrderResponse>>> myDeliveries(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getMyDeliveries(userId, tenantId)));
    }

    @GetMapping("/my-delivery-history")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DELIVERY_VIEW')")
    @Operation(summary = "Daily activity history for the calling delivery person")
    public ResponseEntity<ApiResponse<OrderDtos.MyDeliveryHistoryResponse>> myDeliveryHistory(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getMyDeliveryHistory(userId, tenantId, date)));
    }
}
