package com.distroiq.api.module.order.dto;

import com.distroiq.api.module.order.entity.Order;
import com.distroiq.api.module.order.entity.Payment;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class OrderDtos {

    @Data
    public static class CreateOrderRequest {
        @NotNull(message = "Customer is required")
        private UUID customerId;

        @NotEmpty(message = "Order must have at least one item")
        @Valid
        private List<OrderItemRequest> items;

        @Size(max = 1000)
        private String notes;
    }

    @Data
    public static class OrderItemRequest {
        @NotNull(message = "Product is required")
        private UUID productId;

        @NotNull @Min(value = 1, message = "Quantity must be at least 1")
        private Integer quantity;

        /** Negotiated unit price — if null, defaults to product's salesRate1 */
        @DecimalMin("0.01")
        private BigDecimal unitPrice;
    }

    @Data
    public static class AssignDeliveryRequest {
        @NotNull(message = "Delivery person ID is required")
        private UUID deliveryPersonId;
    }

    @Data
    public static class VerifyItemsRequest {
        @NotEmpty
        @Valid
        private List<ItemVerification> items;
    }

    @Data
    public static class ItemVerification {
        @NotNull private UUID itemId;
        @NotNull @Min(0) private Integer verifiedQuantity;
    }

    @Data
    public static class UpdateStatusRequest {
        @Size(max = 500)
        private String notes;
    }

    // Responses
    @Data
    public static class OrderResponse {
        private UUID id;
        private String orderNumber;
        private Order.OrderStatus status;
        private LocalDate orderDate;
        private CustomerInfo customer;
        private PersonInfo salesPerson;
        private PersonInfo deliveryPerson;
        private PersonInfo approvedBy;
        private List<OrderItemResponse> items;
        private BigDecimal subTotal;
        private BigDecimal totalGst;
        private BigDecimal totalAmount;
        private BigDecimal paidAmount;
        private BigDecimal balanceAmount;
        private String notes;
        private String invoiceUrl;
        private Instant approvedAt;
        private Instant preparedAt;
        private Instant dispatchedAt;
        private Instant deliveredAt;
        private Instant createdAt;
    }

    @Data
    public static class OrderItemResponse {
        private UUID id;
        private ProductInfo product;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal gstPercent;
        private BigDecimal gstAmount;
        private BigDecimal lineTotal;
        private String batchNumber;
        private LocalDate batchExpiryDate;
        private boolean verified;
        private Integer verifiedQuantity;
    }

    @Data
    public static class OrderSummary {
        private UUID id;
        private String orderNumber;
        private Order.OrderStatus status;
        private LocalDate orderDate;
        private String customerName;
        private BigDecimal totalAmount;
        private BigDecimal paidAmount;
        private BigDecimal balanceAmount;
    }

    @Data
    public static class CustomerOutstandingSummary {
        private UUID customerId;
        private String businessName;
        private String ownerName;
        private String phone;
        private String routeName;
        private BigDecimal totalOrdered;
        private BigDecimal totalPaid;
        private BigDecimal outstanding;
        private LocalDate lastOrderDate;
        private LocalDate lastPaymentDate;
        private int orderCount;
    }

    @Data
    public static class CustomerInfo {
        private UUID id;
        private String businessName;
        private String ownerName;
        private String phone;
        private String address;
        private Double latitude;
        private Double longitude;
    }

    @Data
    public static class PersonInfo {
        private UUID id;
        private String fullName;
        private String phone;
    }

    @Data
    public static class ProductInfo {
        private UUID id;
        private String name;
        private String brand;
        private String unit;
        private String imageUrl;
    }

    // Payment DTOs
    @Data
    public static class CreatePaymentRequest {
        @NotNull private UUID orderId;
        @NotNull @DecimalMin("0.01") private BigDecimal amount;
        /** References payment_methods table. Mode is resolved from this. */
        private UUID paymentMethodId;
        /** Fallback if paymentMethodId not provided — resolved from paymentMethod when ID given */
        private Payment.PaymentMode paymentMode;
        @Size(max = 200) private String referenceNumber;
        @Size(max = 500) private String notes;
    }

    @Data
    public static class ClearPaymentsRequest {
        @NotEmpty private List<UUID> paymentIds;
        @Size(max = 500) private String notes;
    }

    @Data
    public static class PaymentResponse {
        private UUID id;
        private OrderSummary order;
        private PersonInfo collectedBy;
        private PersonInfo verifiedBy;
        private BigDecimal amount;
        private Payment.PaymentMode paymentMode;
        private String paymentMethodName;
        private String referenceNumber;
        private LocalDate collectionDate;
        private boolean cleared;
        private Instant clearedAt;
        private boolean submitted;
        private Instant submittedAt;
        private String notes;
        private Instant createdAt;
    }

    @Data
    public static class MyDaySummaryResponse {
        private LocalDate date;
        private BigDecimal totalCollected;
        private BigDecimal cashAmount;
        private BigDecimal upiAmount;
        private BigDecimal chequeAmount;
        private BigDecimal neftAmount;
        private BigDecimal rtgsAmount;
        private BigDecimal creditAmount;
        private int totalPayments;
        private boolean allSubmitted;
        private List<PaymentResponse> payments;
    }

    @Data
    public static class DailySummaryResponse {
        private UUID personId;
        private String personName;
        private String phone;
        private BigDecimal totalCollected;
        private BigDecimal cashAmount;
        private BigDecimal upiAmount;
        private BigDecimal chequeAmount;
        private BigDecimal neftAmount;
        private BigDecimal rtgsAmount;
        private BigDecimal creditAmount;
        private boolean allCleared;
        private List<PaymentResponse> payments;
    }

    @Data
    public static class RoutePicklistResponse {
        private UUID routeId;
        private String routeName;
        private LocalDate date;
        private int totalOrders;
        private int approvedCount;
        private int preparingCount;
        private int preparedCount;
        private List<PickItem> pickList;
        private List<RouteOrderSummary> orders;

        @Data
        public static class PickItem {
            private UUID productId;
            private String productName;
            private String brand;
            private String unit;
            private int totalQuantity;
            private List<CustomerQty> breakdown;
        }

        @Data
        public static class CustomerQty {
            private UUID customerId;
            private UUID orderId;
            private String orderNumber;
            private String businessName;
            private int quantity;
        }

        @Data
        public static class RouteOrderSummary {
            private UUID orderId;
            private String orderNumber;
            private String customerName;
            private String status;
            private BigDecimal totalAmount;
            private int itemCount;
        }
    }

    @Data
    public static class BatchRouteRequest {
        @NotNull private UUID routeId;
        @NotNull private LocalDate date;
    }
}
