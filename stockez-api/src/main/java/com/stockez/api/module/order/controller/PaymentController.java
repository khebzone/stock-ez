package com.stockez.api.module.order.controller;

import com.stockez.api.module.order.dto.OrderDtos;
import com.stockez.api.module.order.service.PaymentService;
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

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Payments", description = "Payment collection and accountant reconciliation")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping
    @PreAuthorize("hasAnyRole('SALES','DELIVERY','ADMIN')")
    @Operation(summary = "Collect payment from customer [SALES/DELIVERY/ADMIN]")
    public ResponseEntity<ApiResponse<OrderDtos.PaymentResponse>> collect(
            @Valid @RequestBody OrderDtos.CreatePaymentRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(paymentService.collectPayment(request, userId, tenantId), "Payment recorded"));
    }

    @GetMapping("/daily")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Get daily collection summary [ACCOUNTANT]")
    public ResponseEntity<ApiResponse<List<OrderDtos.DailySummaryResponse>>> daily(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) LocalDate date) {
        LocalDate d = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(ApiResponse.success(paymentService.getDailyCollections(tenantId, d)));
    }

    @GetMapping("/uncleared/{personId}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Get uncleared payments for a person [ACCOUNTANT]")
    public ResponseEntity<ApiResponse<List<OrderDtos.PaymentResponse>>> uncleared(
            @PathVariable UUID personId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getUnclearedPayments(personId, tenantId)));
    }

    @PostMapping("/clear")
    @PreAuthorize("hasRole('ACCOUNTANT')")
    @Operation(summary = "Clear/verify payments [ACCOUNTANT]")
    public ResponseEntity<ApiResponse<Void>> clear(
            @Valid @RequestBody OrderDtos.ClearPaymentsRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        paymentService.clearPayments(request, userId, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Payments cleared successfully"));
    }

    @GetMapping("/order/{orderId}")
    @PreAuthorize("hasAnyRole('ADMIN','INVOICE','ACCOUNTANT')")
    @Operation(summary = "Get payments for an order")
    public ResponseEntity<ApiResponse<List<OrderDtos.PaymentResponse>>> byOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPaymentsByOrder(orderId, tenantId)));
    }

    @GetMapping("/my-day")
    @PreAuthorize("hasAnyRole('SALES','DELIVERY')")
    @Operation(summary = "Get my today's collection summary [SALES/DELIVERY]")
    public ResponseEntity<ApiResponse<OrderDtos.MyDaySummaryResponse>> myDay(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getMyDayCollections(userId, tenantId)));
    }

    @PostMapping("/submit-day")
    @PreAuthorize("hasAnyRole('SALES','DELIVERY')")
    @Operation(summary = "Submit today's collections to accountant [SALES/DELIVERY]")
    public ResponseEntity<ApiResponse<OrderDtos.MyDaySummaryResponse>> submitDay(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                paymentService.submitDayCollections(userId, tenantId), "Day collections submitted to accountant"));
    }

    @GetMapping("/pending-verification")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    @Operation(summary = "Get submitted-but-uncleared collections grouped by person [ACCOUNTANT]")
    public ResponseEntity<ApiResponse<List<OrderDtos.DailySummaryResponse>>> pendingVerification(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPendingVerifications(tenantId)));
    }

    @GetMapping("/customer-outstanding")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Get all customers with outstanding balances")
    public ResponseEntity<ApiResponse<List<OrderDtos.CustomerOutstandingSummary>>> customerOutstanding(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getCustomerOutstanding(tenantId, userId)));
    }

    @GetMapping("/customer/{customerId}/orders")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Get unpaid orders for a customer")
    public ResponseEntity<ApiResponse<List<OrderDtos.OrderSummary>>> customerOrders(
            @PathVariable UUID customerId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getUnpaidOrdersByCustomer(customerId, tenantId)));
    }

    @GetMapping("/customer/{customerId}/history")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Get payment history for a customer")
    public ResponseEntity<ApiResponse<List<OrderDtos.PaymentResponse>>> customerHistory(
            @PathVariable UUID customerId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getCustomerPaymentHistory(customerId, tenantId)));
    }
}
