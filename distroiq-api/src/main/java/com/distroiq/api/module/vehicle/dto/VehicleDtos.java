package com.distroiq.api.module.vehicle.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

        @NotBlank(message = "Insurance number is required")
        @Size(max = 50)
        private String insuranceNumber;

        @NotNull(message = "Insurance expiry date is required")
        private LocalDate insuranceExpiryDate;
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

        @NotBlank(message = "Insurance number is required")
        @Size(max = 50)
        private String insuranceNumber;

        @NotNull(message = "Insurance expiry date is required")
        private LocalDate insuranceExpiryDate;

        private boolean active;
    }

    @Data
    public static class VehicleResponse {
        private UUID id;
        private String vehicleNumber;
        private String vehicleType;
        private String model;
        private String insuranceNumber;
        private LocalDate insuranceExpiryDate;
        private boolean insuranceExpired;
        private boolean insuranceNearExpiry;
        private Integer insuranceDaysToExpiry;
        private boolean active;
        private Instant createdAt;
    }

    @Data
    public static class InsuranceAlert {
        private UUID vehicleId;
        private String vehicleNumber;
        private String vehicleType;
        private LocalDate insuranceExpiryDate;
        private int daysToExpiry;
    }
}
