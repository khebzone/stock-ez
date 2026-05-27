package com.stockez.api.module.sales.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class SalesDtos {

    @Data
    public static class MyAllocationResponse {
        private UUID allocationId;
        private UUID routeId;
        private String routeName;
        private LocalDate allocationDate;
        private String status;
        private List<CustomerSummary> customers;
    }

    @Data
    public static class CustomerSummary {
        private UUID id;
        private String businessName;
        private String ownerName;
        private String phone;
        private String address;
        private String placeName;
        private UUID placeId;
        private Integer visitOrder;
        private BigDecimal creditLimit;
        private boolean creditAllowed;
        private Double latitude;
        private Double longitude;
    }

    @Data
    public static class MyHistoryResponse {
        private LocalDate date;
        private String routeName;
        private int ordersCount;
        private BigDecimal totalSales;
        private BigDecimal cashCollected;
        private BigDecimal upiCollected;
        private BigDecimal otherCollected;
        private BigDecimal totalCollected;
        private List<OrderSummary> orders;

        @Data
        public static class OrderSummary {
            private UUID orderId;
            private String orderNumber;
            private String customerName;
            private String customerPhone;
            private BigDecimal totalAmount;
            private BigDecimal paidAmount;
            private String status;
            private int itemCount;
        }
    }
}
