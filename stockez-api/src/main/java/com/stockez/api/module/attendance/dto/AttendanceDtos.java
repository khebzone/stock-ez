package com.stockez.api.module.attendance.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public class AttendanceDtos {

    @Data
    public static class SettingsRequest {
        @NotNull(message = "Office latitude is required")
        private Double officeLatitude;

        @NotNull(message = "Office longitude is required")
        private Double officeLongitude;

        private Integer geofenceRadiusM = 100;

        private String lateThresholdTime = "09:00";
    }

    @Data
    public static class SettingsResponse {
        private UUID id;
        private Double officeLatitude;
        private Double officeLongitude;
        private Integer geofenceRadiusM;
        private String lateThresholdTime;
        private boolean configured;
    }

    @Data
    public static class CheckInRequest {
        @NotNull(message = "Latitude is required")
        private Double latitude;

        @NotNull(message = "Longitude is required")
        private Double longitude;
    }

    @Data
    public static class CheckOutRequest {
        private Double latitude;
        private Double longitude;
    }

    @Data
    public static class AttendanceResponse {
        private UUID id;
        private UUID userId;
        private String userName;
        private String userRole;
        private LocalDate attendanceDate;
        private Instant checkInTime;
        private Instant checkOutTime;
        private String status;
        private boolean checkedIn;
        private boolean checkedOut;
    }

    @Data
    public static class TodayStatusResponse {
        private boolean configured;
        private boolean checkInAnywhere;
        private boolean checkedIn;
        private boolean checkedOut;
        private Instant checkInTime;
        private Instant checkOutTime;
        private String status;
    }
}
