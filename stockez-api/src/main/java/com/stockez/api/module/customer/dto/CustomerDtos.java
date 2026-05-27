package com.stockez.api.module.customer.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class CustomerDtos {

    @Data
    public static class CreateCustomerRequest {
        @NotBlank(message = "Business name is required") @Size(max = 200)
        private String businessName;

        @NotBlank(message = "Owner name is required") @Size(max = 100)
        private String ownerName;

        @NotBlank(message = "Phone is required")
        @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter valid 10-digit phone")
        private String phone;

        @Pattern(regexp = "^[6-9]\\d{9}$")
        private String altPhone;

        @Email private String email;

        @Size(max = 500) private String address;

        @Pattern(regexp = "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$",
                 message = "Invalid GSTIN format")
        private String gstin;

        @NotNull(message = "Route is required")
        private UUID routeId;

        @NotNull(message = "Route place is required")
        private UUID routePlaceId;

        private boolean creditAllowed = false;
        private Integer creditDays = 0;
        private BigDecimal creditLimit = BigDecimal.ZERO;
        private Double latitude;
        private Double longitude;
        private String ownerImageUrl;
        private String shopImageUrl;
    }

    @Data
    public static class UpdateCustomerRequest {
        @NotBlank @Size(max = 200) private String businessName;
        @NotBlank @Size(max = 100) private String ownerName;
        @Pattern(regexp = "^[6-9]\\d{9}$") private String altPhone;
        @Email private String email;
        @Size(max = 500) private String address;
        private String gstin;
        private UUID routeId;
        private UUID routePlaceId;
        private boolean creditAllowed;
        private Integer creditDays;
        private BigDecimal creditLimit;
        private Double latitude;
        private Double longitude;
        private String ownerImageUrl;
        private String shopImageUrl;
    }

    @Data
    public static class CustomerResponse {
        private UUID id;
        private String businessName;
        private String ownerName;
        private String phone;
        private String altPhone;
        private String email;
        private String address;
        private String gstin;
        private RouteInfo route;
        private PlaceInfo routePlace;
        private boolean creditAllowed;
        private Integer creditDays;
        private BigDecimal creditLimit;
        private Integer visitOrder;
        private Double latitude;
        private Double longitude;
        private String ownerImageUrl;
        private String shopImageUrl;
        private boolean active;
        private Instant createdAt;
    }

    /** Reorder customers within a place: ordered list of customer IDs */
    @Data
    public static class ReorderCustomersRequest {
        private java.util.List<UUID> customerIds;
    }

    @Data
    public static class RouteInfo {
        private UUID id;
        private String name;
    }

    @Data
    public static class PlaceInfo {
        private UUID id;
        private String name;
    }

    @Data
    public static class CustomerSummary {
        private UUID id;
        private String businessName;
        private String ownerName;
        private String phone;
        private String address;
        private Double latitude;
        private Double longitude;
    }

    @Data
    public static class CustomerOutstandingResponse {
        private UUID customerId;
        private String businessName;
        private BigDecimal totalOutstanding;
        private BigDecimal bucket0to30;
        private BigDecimal bucket31to60;
        private BigDecimal bucket61to90;
        private BigDecimal bucket90plus;
        private BigDecimal creditLimit;
        private boolean creditAllowed;
        private Integer creditDays;
        private boolean overLimit;
    }
}
