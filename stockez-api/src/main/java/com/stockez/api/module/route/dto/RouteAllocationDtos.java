package com.stockez.api.module.route.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class RouteAllocationDtos {

    @Data
    public static class AllocateSalesRequest {
        @NotNull(message = "Route is required")
        private UUID routeId;
        @NotNull(message = "Allocation date is required")
        private LocalDate allocationDate;
        private UUID salesPersonId;
        private UUID salesVehicleId;
        private Integer salesStartKm;
        private Integer salesEndKm;
        private String notes;
    }

    @Data
    public static class AllocateDeliveryRequest {
        @NotNull(message = "Route is required")
        private UUID routeId;
        @NotNull(message = "Allocation date is required")
        private LocalDate allocationDate;
        private UUID deliveryPersonId;
        private UUID deliveryVehicleId;
        private Integer deliveryStartKm;
        private Integer deliveryEndKm;
        private String notes;
    }

    @Data
    public static class AllocateWarehouseRequest {
        @NotNull(message = "Route is required")
        private UUID routeId;
        @NotNull(message = "Allocation date is required")
        private LocalDate allocationDate;
        private UUID warehousePersonId;
    }

    @Data
    public static class AllocateRouteRequest {
        @NotNull(message = "Route is required")
        private UUID routeId;
        @NotNull(message = "Allocation date is required")
        private LocalDate allocationDate;
        private UUID salesPersonId;
        private UUID deliveryPersonId;
        private UUID salesVehicleId;
        private UUID deliveryVehicleId;
        private Integer salesStartKm;
        private Integer salesEndKm;
        private Integer deliveryStartKm;
        private Integer deliveryEndKm;
        private String notes;
    }

    @Data
    public static class RouteAllocationResponse {
        private UUID id;
        private UUID routeId;
        private String routeName;
        private LocalDate allocationDate;
        private UserSummary salesPerson;
        private UserSummary deliveryPerson;
        private UserSummary warehousePerson;
        private VehicleSummary salesVehicle;
        private VehicleSummary deliveryVehicle;
        private Integer salesStartKm;
        private Integer salesEndKm;
        private Integer deliveryStartKm;
        private Integer deliveryEndKm;
        private String status;
        private String notes;
    }

    @Data
    public static class UserSummary {
        private UUID id;
        private String fullName;
        private String phone;
        private String role;
    }

    @Data
    public static class VehicleSummary {
        private UUID id;
        private String vehicleNumber;
        private String vehicleType;
        private String model;
    }

    @Data
    public static class DailyAllocationSummary {
        private LocalDate date;
        private List<RouteAllocationResponse> allocations;
    }

    @Data
    public static class RouteDeliverySummary {
        private LocalDate date;
        private List<RouteDeliveryRow> routes;
    }

    @Data
    public static class RouteDeliveryRow {
        private UUID routeId;
        private String routeName;
        private int preparedCount;
        private int dispatchedCount;
        private BigDecimal preparedValue;
        private UUID allocationId;
        private UserSummary deliveryPerson;
        private VehicleSummary deliveryVehicle;
        private Integer deliveryStartKm;
        private Integer deliveryEndKm;
    }

    @Data
    public static class RouteWarehouseSummary {
        private LocalDate date;
        private List<RouteWarehouseRow> routes;
    }

    @Data
    public static class RouteWarehouseRow {
        private UUID routeId;
        private String routeName;
        private int approvedCount;
        private int preparingCount;
        private int preparedCount;
        private UUID allocationId;
        private UserSummary warehousePerson;
    }

    @Data
    public static class FieldActivityResponse {
        private LocalDate date;
        private List<ActivityItem> activities;

        @Data
        public static class ActivityItem {
            private UUID allocationId;
            private String routeName;
            private String type;
            private UserSummary person;
            private VehicleSummary vehicle;
            private Integer startKm;
            private Integer endKm;
            private Integer kmDriven;
            private String status;
            private int ordersCount;
            private BigDecimal ordersValue;
            private BigDecimal cashCollected;
            private BigDecimal upiCollected;
            private BigDecimal otherCollected;
            private BigDecimal totalCollected;
            private int deliveriesCompleted;
            private List<OrderSummary> orders = new java.util.ArrayList<>();
        }

        @Data
        public static class OrderSummary {
            private UUID orderId;
            private String orderNumber;
            private String customerName;
            private String customerPhone;
            private int itemCount;
            private BigDecimal totalAmount;
            private BigDecimal paidAmount;
            private BigDecimal balanceAmount;
            private String status;
        }
    }
}
