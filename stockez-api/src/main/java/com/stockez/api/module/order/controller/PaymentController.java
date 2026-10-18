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
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_CREATE','DELIVERY_UPDATE')")
    @Operation(summary = "Collect payment from customer")
    public ResponseEntity<ApiResponse<OrderDtos.PaymentResponse>> collect(
            @Valid @RequestBody OrderDtos.CreatePaymentRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            org.springframework.security.core.Authentication authentication) {
        // Only office staff (admin / customer-outstanding) may back-date a collection.
        // Field staff collections are always stamped with today's date.
        if (request.getCollectionDate() != null && !canBackdate(authentication)) {
            request.setCollectionDate(null);
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(paymentService.collectPayment(request, userId, tenantId), "Payment recorded"));
    }

    private boolean canBackdate(org.springframework.security.core.Authentication auth) {
        if (auth == null) return false;
        return auth.getAuthorities().stream().map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_ADMIN") || a.equals("CUSTOMER_OUTSTANDING_VIEW"));
    }

    @GetMapping("/daily")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DAY_CLOSURE_VIEW')")
    @Operation(summary = "Get daily collection summary")
    public ResponseEntity<ApiResponse<List<OrderDtos.DailySummaryResponse>>> daily(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) LocalDate date) {
        LocalDate d = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(ApiResponse.success(paymentService.getDailyCollections(tenantId, d)));
    }

    @GetMapping("/uncleared/{personId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DAY_CLOSURE_VIEW')")
    @Operation(summary = "Get uncleared payments for a person")
    public ResponseEntity<ApiResponse<List<OrderDtos.PaymentResponse>>> uncleared(
            @PathVariable UUID personId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getUnclearedPayments(personId, tenantId)));
    }

    @PostMapping("/clear")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DAY_CLOSURE_CREATE')")
    @Operation(summary = "Clear/verify payments")
    public ResponseEntity<ApiResponse<Void>> clear(
            @Valid @RequestBody OrderDtos.ClearPaymentsRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        paymentService.clearPayments(request, userId, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Payments cleared successfully"));
    }

    @PostMapping("/{paymentId}/void")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_CREATE','DELIVERY_UPDATE','DAY_CLOSURE_CREATE')")
    @Operation(summary = "Void a wrongly entered payment")
    public ResponseEntity<ApiResponse<Void>> voidPayment(
            @PathVariable UUID paymentId,
            @Valid @RequestBody OrderDtos.VoidPaymentRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            org.springframework.security.core.Authentication authentication) {
        boolean canVoidAny = authentication != null && authentication.getAuthorities().stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_ADMIN") || a.equals("DAY_CLOSURE_CREATE"));
        paymentService.voidPayment(paymentId, request.getReason(), userId, tenantId, canVoidAny);
        return ResponseEntity.ok(ApiResponse.success(null, "Payment voided"));
    }

    @PutMapping("/{paymentId}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_CREATE','DELIVERY_UPDATE','DAY_CLOSURE_CREATE')")
    @Operation(summary = "Edit a payment entry before it is cleared")
    public ResponseEntity<ApiResponse<OrderDtos.PaymentResponse>> editPayment(
            @PathVariable UUID paymentId,
            @Valid @RequestBody OrderDtos.EditPaymentRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            org.springframework.security.core.Authentication authentication) {
        boolean canEditAny = authentication != null && authentication.getAuthorities().stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_ADMIN") || a.equals("DAY_CLOSURE_CREATE"));
        return ResponseEntity.ok(ApiResponse.success(
                paymentService.editPayment(paymentId, request, userId, tenantId, canEditAny), "Payment updated"));
    }

    @GetMapping("/changes")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('DAY_CLOSURE_VIEW','DAY_CLOSURE_CREATE')")
    @Operation(summary = "Voided and edited payment entries with who changed them")
    public ResponseEntity<ApiResponse<List<OrderDtos.PaymentChangeEntry>>> changes(
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPaymentChanges(tenantId, from, to)));
    }

    @GetMapping("/instruments")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('DAY_CLOSURE_VIEW','BANK_CLEARANCE_VIEW')")
    @Operation(summary = "Get all cheque / bank-transfer instruments for bank clearance")
    public ResponseEntity<ApiResponse<List<OrderDtos.PaymentResponse>>> instruments(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getInstruments(tenantId)));
    }

    @PostMapping("/{paymentId}/deposit")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('DAY_CLOSURE_CREATE','BANK_CLEARANCE_UPDATE')")
    @Operation(summary = "Mark a cheque/transfer as deposited to bank")
    public ResponseEntity<ApiResponse<OrderDtos.PaymentResponse>> deposit(
            @PathVariable UUID paymentId,
            @Valid @RequestBody OrderDtos.DepositInstrumentRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(
                paymentService.depositInstrument(paymentId, request, tenantId), "Marked as deposited"));
    }

    @PostMapping("/{paymentId}/realise")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('DAY_CLOSURE_CREATE','BANK_CLEARANCE_UPDATE')")
    @Operation(summary = "Mark a cheque/transfer as realised (cleared in bank)")
    public ResponseEntity<ApiResponse<OrderDtos.PaymentResponse>> realise(
            @PathVariable UUID paymentId,
            @Valid @RequestBody OrderDtos.RealiseInstrumentRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(
                paymentService.realiseInstrument(paymentId, request, tenantId), "Marked as realised"));
    }

    @PostMapping("/{paymentId}/bounce")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('DAY_CLOSURE_CREATE','BANK_CLEARANCE_UPDATE')")
    @Operation(summary = "Mark a cheque/transfer as bounced/returned")
    public ResponseEntity<ApiResponse<OrderDtos.PaymentResponse>> bounce(
            @PathVariable UUID paymentId,
            @Valid @RequestBody OrderDtos.BounceInstrumentRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(
                paymentService.bounceInstrument(paymentId, request, tenantId), "Marked as bounced"));
    }

    @GetMapping("/order/{orderId}")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('INVOICE_VIEW','DAY_CLOSURE_VIEW')")
    @Operation(summary = "Get payments for an order")
    public ResponseEntity<ApiResponse<List<OrderDtos.PaymentResponse>>> byOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPaymentsByOrder(orderId, tenantId)));
    }

    @GetMapping("/my-day")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_VIEW','PAYMENTS_CREATE','DELIVERY_UPDATE')")
    @Operation(summary = "Get my today's collection summary")
    public ResponseEntity<ApiResponse<OrderDtos.MyDaySummaryResponse>> myDay(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getMyDayCollections(userId, tenantId)));
    }

    @PostMapping("/submit-day")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_CREATE','DELIVERY_UPDATE')")
    @Operation(summary = "Submit today's collections")
    public ResponseEntity<ApiResponse<OrderDtos.MyDaySummaryResponse>> submitDay(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                paymentService.submitDayCollections(userId, tenantId), "Day collections submitted to accountant"));
    }

    @GetMapping("/awaiting-submission")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DAY_CLOSURE_VIEW')")
    @Operation(summary = "Get collections not yet submitted, grouped by person")
    public ResponseEntity<ApiResponse<List<OrderDtos.DailySummaryResponse>>> awaitingSubmission(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getAwaitingSubmission(tenantId)));
    }

    @PostMapping("/submit-day/{personId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DAY_CLOSURE_CREATE')")
    @Operation(summary = "Submit a person's collections on their behalf")
    public ResponseEntity<ApiResponse<Void>> submitOnBehalf(
            @PathVariable UUID personId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        paymentService.submitOnBehalf(personId, userId, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Collections submitted"));
    }

    @GetMapping("/pending-verification")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('DAY_CLOSURE_VIEW')")
    @Operation(summary = "Get submitted-but-uncleared collections grouped by person")
    public ResponseEntity<ApiResponse<List<OrderDtos.DailySummaryResponse>>> pendingVerification(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPendingVerifications(tenantId)));
    }

    @GetMapping("/customer-outstanding")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_VIEW','DELIVERY_UPDATE','CUSTOMERS_VIEW','CUSTOMER_OUTSTANDING_VIEW')")
    @Operation(summary = "Get all customers with outstanding balances")
    public ResponseEntity<ApiResponse<List<OrderDtos.CustomerOutstandingSummary>>> customerOutstanding(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getCustomerOutstanding(tenantId, userId)));
    }

    @GetMapping("/route-outstanding")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_VIEW','DELIVERY_UPDATE','CUSTOMERS_VIEW','CUSTOMER_OUTSTANDING_VIEW')")
    @Operation(summary = "Get outstanding balances grouped by route")
    public ResponseEntity<ApiResponse<List<OrderDtos.RouteOutstandingGroup>>> routeOutstanding(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getRouteOutstanding(tenantId)));
    }

    @GetMapping("/customer/{customerId}/orders")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_VIEW','DELIVERY_UPDATE','CUSTOMERS_VIEW')")
    @Operation(summary = "Get unpaid orders for a customer")
    public ResponseEntity<ApiResponse<List<OrderDtos.OrderSummary>>> customerOrders(
            @PathVariable UUID customerId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getUnpaidOrdersByCustomer(customerId, tenantId)));
    }

    @GetMapping("/customer/{customerId}/history")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_VIEW','CUSTOMERS_VIEW')")
    @Operation(summary = "Get payment history for a customer")
    public ResponseEntity<ApiResponse<List<OrderDtos.PaymentResponse>>> customerHistory(
            @PathVariable UUID customerId,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getCustomerPaymentHistory(customerId, tenantId)));
    }

    @GetMapping("/salesman-outstanding")
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('PAYMENTS_VIEW','CUSTOMERS_VIEW')")
    @Operation(summary = "Get all salesman credit outstanding — unpaid orders grouped by salesperson")
    public ResponseEntity<ApiResponse<List<OrderDtos.SalesmanCreditSummary>>> salesmanOutstanding(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getSalesmanCreditOutstanding(tenantId)));
    }
}
