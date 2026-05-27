package com.stockez.api.module.vehicle.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public class VehicleDtos {

    @Data
    public static class CreateVehicleRequest {
        @NotBlank(message = "Vehicle number is required")
        @Size(max = 20)
        @Pattern(
            regexp = "^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$",
            message = "Invalid vehicle number — expected format: TN45AB1234"
        )
        private String vehicleNumber;

        @NotBlank(message = "Vehicle type is required")
        @Size(max = 50)
        private String vehicleType;

        @Size(max = 100)
        private String model;

        private LocalDate fcExpiryDate;

        @Size(max = 50)
        private String insuranceNumber;

        private LocalDate insuranceExpiryDate;

        private LocalDate pucExpiryDate;

        private LocalDate goodsPermitExpiryDate;

        private LocalDate lastServiceDate;

        private LocalDate nextServiceDueDate;
    }

    @Data
    public static class UpdateVehicleRequest {
        @NotBlank @Size(max = 20)
        @Pattern(
            regexp = "^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$",
            message = "Invalid vehicle number — expected format: TN45AB1234"
        )
        private String vehicleNumber;

        @NotBlank @Size(max = 50)
        private String vehicleType;

        @Size(max = 100)
        private String model;

        private LocalDate fcExpiryDate;

        @Size(max = 50)
        private String insuranceNumber;

        private LocalDate insuranceExpiryDate;

        private LocalDate pucExpiryDate;

        private LocalDate goodsPermitExpiryDate;

        private LocalDate lastServiceDate;

        private LocalDate nextServiceDueDate;

        private boolean active;
    }

    @Data
    public static class VehicleResponse {
        private UUID id;
        private String vehicleNumber;
        private String vehicleType;
        private String model;

        private LocalDate fcExpiryDate;
        private boolean fcExpired;
        private boolean fcNearExpiry;
        private Integer fcDaysToExpiry;

        private String insuranceNumber;
        private LocalDate insuranceExpiryDate;
        private boolean insuranceExpired;
        private boolean insuranceNearExpiry;
        private Integer insuranceDaysToExpiry;

        private LocalDate pucExpiryDate;
        private boolean pucExpired;
        private boolean pucNearExpiry;
        private Integer pucDaysToExpiry;

        private LocalDate goodsPermitExpiryDate;
        private boolean goodsPermitExpired;
        private boolean goodsPermitNearExpiry;
        private Integer goodsPermitDaysToExpiry;

        private LocalDate lastServiceDate;
        private LocalDate nextServiceDueDate;

        private boolean active;
        private Instant createdAt;
    }

    @Data
    public static class ExpiryAlert {
        private UUID vehicleId;
        private String vehicleNumber;
        private String vehicleType;
        private String documentType;
        private LocalDate expiryDate;
        private int daysToExpiry;
    }
}
