package com.stockez.api.module.order.dto;

import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.Payment;
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

        /** Bill-level discount type: PERCENT or AMOUNT (null = none) */
        private String overallDiscountType;
        /** The % or ₹ the biller entered for the overall discount */
        @DecimalMin("0")
        private BigDecimal overallDiscountValue;
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

        /** Trade discount % applied on lineGross before GST extraction (0–100) */
        @DecimalMin("0") @DecimalMax("100")
        private BigDecimal discountPercent;

        /** Flat ₹ discount per line — used when tenant discountType=AMOUNT; mutually exclusive with discountPercent */
        @DecimalMin("0")
        private BigDecimal discountAmount;
    }

    @Data
    public static class UpdateOrderRequest {
        @NotEmpty(message = "Order must have at least one item")
        @Valid
        private List<OrderItemRequest> items;

        @Size(max = 1000)
        private String notes;

        private String overallDiscountType;
        @DecimalMin("0")
        private BigDecimal overallDiscountValue;
    }

    @Data
    public static class AdjustDeliveredPriceRequest {
        @NotEmpty(message = "At least one item is required")
        @Valid
        private List<AdjustPriceItem> items;

        private String overallDiscountType;
        @DecimalMin("0")
        private BigDecimal overallDiscountValue;
    }

    @Data
    public static class AdjustPriceItem {
        @NotNull private UUID itemId;

        @NotNull @DecimalMin("0.01")
        private BigDecimal unitPrice;

        @DecimalMin("0") @DecimalMax("100")
        private BigDecimal discountPercent;

        @DecimalMin("0")
        private BigDecimal discountAmount;
    }

    @Data
    public static class AssignDeliveryRequest {
        @NotNull(message = "Delivery person ID is required")
        private UUID deliveryPersonId;
    }

    @Data
    public static class BulkApproveRequest {
        @NotEmpty(message = "At least one order is required")
        private List<UUID> orderIds;
    }

    @Data
    public static class BulkApproveResponse {
        private int approvedCount;
        private List<BulkApproveFailure> failures;

        @Data
        public static class BulkApproveFailure {
            private UUID orderId;
            private String orderNumber;
            private String reason;
        }
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

    @Data
    public static class ChangeOrderStatusRequest {
        @NotNull(message = "Target status is required")
        private Order.OrderStatus status;
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
        private BigDecimal roundOffAmount;
        private String overallDiscountType;
        private BigDecimal overallDiscountValue;
        private BigDecimal overallDiscountAmount;
        private BigDecimal totalAmount;
        private BigDecimal paidAmount;
        private BigDecimal balanceAmount;
        private String notes;
        private String invoiceUrl;
        private Instant approvedAt;
        private Instant packedAt;
        private Instant dispatchedAt;
        private Instant deliveredAt;
        private Instant createdAt;
    }

    @Data
    public static class OrderItemResponse {
        private UUID id;
        private ProductInfo product;
        private Integer quantity;
        private BigDecimal mrp;
        private BigDecimal unitPrice;
        private BigDecimal discountPercent;
        private BigDecimal discountAmount;
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
        private boolean openingBalance;
    }

    @Data
    public static class CustomerOutstandingSummary {
        private UUID customerId;
        private String businessName;
        private String ownerName;
        private String phone;
        private UUID routeId;
        private String routeName;
        private UUID routePlaceId;
        private String routePlaceName;
        private BigDecimal totalOrdered;
        private BigDecimal totalPaid;
        private BigDecimal outstanding;
        private LocalDate lastOrderDate;
        private LocalDate lastPaymentDate;
        private LocalDate oldestUnpaidOrderDate;
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
        private String routeName;
        private String routePlaceName;
        private String gstin;
        private String city;
        private String state;
        private String pinCode;
        private BigDecimal customerOutstanding;
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
        private String hsnCode;
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
        /** Cheque date (supports post-dated) / instrument date */
        private LocalDate instrumentDate;
        /** Customer's bank (cheque) or remitting bank (NEFT/RTGS) */
        @Size(max = 150) private String draweeBank;
        /** Back-office entries (Customer Outstanding screen) submit straight to the accountant for verification */
        private boolean autoSubmit;
        /** Office back-dating: date the collection actually happened. Ignored for field staff (forced to today). */
        private LocalDate collectionDate;
        @Size(max = 500) private String notes;
    }

    @Data
    public static class ClearPaymentsRequest {
        @NotEmpty private List<UUID> paymentIds;
        @Size(max = 500) private String notes;
    }

    @Data
    public static class DepositInstrumentRequest {
        private LocalDate depositDate;
        @Size(max = 150) private String depositBank;
    }

    @Data
    public static class RealiseInstrumentRequest {
        private LocalDate realisedDate;
    }

    @Data
    public static class BounceInstrumentRequest {
        @NotEmpty @Size(max = 300) private String bounceReason;
        @DecimalMin("0") private BigDecimal bankCharges;
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
        private Payment.PaymentStatus status;
        private LocalDate instrumentDate;
        private LocalDate depositDate;
        private LocalDate realisedDate;
        private String draweeBank;
        private String depositBank;
        private String bounceReason;
        private BigDecimal bankCharges;
        private String customerName;
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
        private int submittedCount;
        private int approvedCount;
        private int packingCount;
        private int packedCount;
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
            private String customerPhone;
            private String status;
            private BigDecimal totalAmount;
            private int itemCount;
            private List<OrderItemLine> items;
        }

        @Data
        public static class OrderItemLine {
            private String productName;
            private String brand;
            private String unit;
            private int quantity;
            private BigDecimal unitPrice;
        }
    }

    @Data
    public static class BatchRouteRequest {
        @NotNull private UUID routeId;
        @NotNull private LocalDate date;
    }

    @Data
    public static class CounterSaleRequest {
        @NotNull(message = "Customer is required")
        private UUID customerId;

        @NotEmpty(message = "Order must have at least one item")
        @Valid
        private List<OrderItemRequest> items;

        @Size(max = 1000)
        private String notes;

        private String overallDiscountType;
        @DecimalMin("0")
        private BigDecimal overallDiscountValue;

        @DecimalMin("0")
        private BigDecimal paymentAmount;

        private UUID paymentMethodId;

        private Payment.PaymentMode paymentMode;

        @Size(max = 200)
        private String paymentReference;

        // Which stage this counter sale lands at — APPROVED, PACKED, or DELIVERED.
        // Defaults to DELIVERED (goods handed over immediately at the counter) when not sent.
        private String finalStatus;

        // Optional: attribute this sale to a specific sales Gate Pass (route allocation) instead
        // of the logged-in caller — e.g. office billing a phone order on behalf of a salesman
        // whose Gate Pass for that route is already completed for today.
        private UUID gatePassId;
    }

    @Data
    public static class CounterSaleResponse {
        private OrderResponse order;
        private PaymentResponse payment;
    }

    // Salesman Credit Outstanding
    @Data
    public static class SalesmanCreditOrderRow {
        private UUID orderId;
        private String orderNumber;
        private LocalDate orderDate;
        private String customerName;
        private String routeName;
        private BigDecimal totalAmount;
        private BigDecimal paidAmount;
        private BigDecimal balanceAmount;
        private boolean openingBalance;
    }

    @Data
    public static class SalesmanCreditSummary {
        private UUID salesPersonId;
        private String salesPersonName;
        private String phone;
        private int orderCount;
        private int customerCount;
        private BigDecimal totalCreditGiven;
        private BigDecimal totalCollected;
        private BigDecimal totalPending;
        private List<SalesmanCreditOrderRow> orders;
    }

    @Data
    public static class CompanyInfo {
        private String name;
        private String ownerName;
        private String phone;
        private String email;
        private String address;
        private String city;
        private String state;
        private String pinCode;
        private String gstin;
        private String fssaiNumber;
        private String panNumber;
        private String logoUrl;
        private String invoiceTerms;
        private String extraImageUrl;
        private String paymentQrImageUrl;
        private String bankName;
        private String bankAccountName;
        private String bankAccountNumber;
        private String bankBranch;
        private String bankIfsc;
        private String stateCode;
        private String invoiceFooterNote;
    }

    @Data
    public static class PublicInvoiceResponse {
        private OrderResponse order;
        private CompanyInfo company;
        private String pdfUrl;
    }

    @Data
    public static class PublicPaymentReceiptResponse {
        private UUID id;
        private BigDecimal amount;
        private String paymentMode;
        private String paymentMethodName;
        private String referenceNumber;
        private LocalDate collectionDate;
        private String orderNumber;
        private String collectedByName;
        private CustomerInfo customer;
        private CompanyInfo company;
    }

    @Data
    public static class PriceEntry {
        private java.math.BigDecimal price;
        private java.time.LocalDate date;
    }

    @Data
    public static class RouteOutstandingGroup {
        private UUID routeId;
        private String routeName;
        private int customerCount;
        private BigDecimal totalOutstanding;
        private List<CustomerOutstandingSummary> customers;
    }

    @Data
    public static class WarehouseReturnGroup {
        private UUID deliveryPersonId;
        private String deliveryPersonName;
        private String deliveryPersonPhone;
        private int orderCount;
        private List<WarehouseReturnOrder> orders;
    }

    @Data
    public static class WarehouseReturnOrder {
        private UUID id;
        private String orderNumber;
        private String customerName;
        private String customerPhone;
        private String routeName;
        private BigDecimal totalAmount;
        private LocalDate orderDate;
        private Instant returnedAt;
        private List<WarehouseReturnItem> items;
    }

    @Data
    public static class WarehouseReturnItem {
        private UUID itemId;
        private String productName;
        private String brand;
        private String unit;
        private int quantity;
        private BigDecimal unitPrice;
        private Integer returnReceivedQuantity;
    }

    @Data
    public static class ConfirmWarehouseReturnRequest {
        @NotEmpty(message = "At least one item is required")
        private List<ReturnItemReceipt> items;
    }

    @Data
    public static class ReturnItemReceipt {
        @NotNull private UUID itemId;
        @NotNull @Min(0) private Integer receivedQty;
    }

    @Data
    public static class MyDeliveryHistoryResponse {
        private LocalDate date;
        private String routeName;
        private int deliveredCount;
        private int ordersCount;
        private BigDecimal totalCollected;
        private BigDecimal cashCollected;
        private BigDecimal upiCollected;
        private BigDecimal otherCollected;
        private List<DeliveryOrderSummary> orders;
        private List<DeliveryPaymentSummary> payments;

        @Data
        public static class DeliveryOrderSummary {
            private UUID orderId;
            private String orderNumber;
            private String customerName;
            private String customerPhone;
            private BigDecimal totalAmount;
            private BigDecimal paidAmount;
            private String status;
            private int itemCount;
        }

        @Data
        public static class DeliveryPaymentSummary {
            private UUID paymentId;
            private String orderNumber;
            private String customerName;
            private BigDecimal amount;
            private String paymentMode;
            private String paymentMethodName;
            private String referenceNumber;
            private boolean submitted;
            private Instant collectedAt;
        }
    }
}
