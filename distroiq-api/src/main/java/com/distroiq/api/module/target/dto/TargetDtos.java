package com.distroiq.api.module.target.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class TargetDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpsertTargetRequest {

        @NotNull(message = "userId is required")
        private UUID userId;

        @NotNull(message = "month is required")
        @Min(value = 1, message = "month must be between 1 and 12")
        @Max(value = 12, message = "month must be between 1 and 12")
        private Integer month;

        @NotNull(message = "year is required")
        @Min(value = 2020, message = "year must be 2020 or later")
        private Integer year;

        @NotNull(message = "targetAmount is required")
        @PositiveOrZero(message = "targetAmount must be >= 0")
        private BigDecimal targetAmount;

        @NotNull(message = "targetOrders is required")
        @PositiveOrZero(message = "targetOrders must be >= 0")
        private Integer targetOrders;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TargetResponse {
        private UUID id;
        private UUID userId;
        private String userName;
        private String userRole;
        private int month;
        private int year;
        private BigDecimal targetAmount;
        private int targetOrders;
        private BigDecimal achievedAmount;
        private int achievedOrders;
        private double achievementPercent;   // by amount
        private double orderAchievementPercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TargetListResponse {
        private int month;
        private int year;
        private List<TargetResponse> targets;
        private BigDecimal totalTargetAmount;
        private BigDecimal totalAchievedAmount;
        private double overallAchievementPercent;
    }
}
