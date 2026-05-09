package com.distroiq.api.module.sales.dto;

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
}
