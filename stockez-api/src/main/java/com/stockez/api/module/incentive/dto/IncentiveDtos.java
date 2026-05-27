package com.stockez.api.module.incentive.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class IncentiveDtos {

    @Data
    public static class SaveTargetRequest {
        @NotNull(message = "Sales person is required")
        private UUID salesPersonId;
        @NotBlank(message = "Brand is required")
        private String brand;
        @NotNull(message = "Month is required")
        private Integer targetMonth;
        @NotNull(message = "Year is required")
        private Integer targetYear;
        @NotNull(message = "Target value is required")
        private BigDecimal targetValue;
    }

    @Data
    public static class BrandTargetRow {
        private UUID id;
        private UUID salesPersonId;
        private String salesPersonName;
        private String salesPersonPhone;
        private String brand;
        private int targetMonth;
        private int targetYear;
        private BigDecimal targetValue;
        private BigDecimal achievedValue;
        private BigDecimal achievementPct;
        private BigDecimal earnedIncentive;
        private String achievementStatus;
    }

    @Data
    public static class TargetSummary {
        private int month;
        private int year;
        private List<BrandTargetRow> targets;
        private BigDecimal totalTarget;
        private BigDecimal totalAchieved;
    }

    @Data
    public static class SlabRequest {
        @NotNull(message = "From % is required")
        private Integer fromPct;
        private Integer toPct;
        @NotNull(message = "Incentive amount is required")
        private BigDecimal incentiveAmount;
    }

    @Data
    public static class SaveSlabsRequest {
        @NotBlank(message = "Brand is required")
        private String brand;
        @NotNull(message = "Slabs list is required")
        private List<SlabRequest> slabs;
    }

    @Data
    public static class IncentiveSlabResponse {
        private UUID id;
        private String brand;
        private int fromPct;
        private Integer toPct;
        private BigDecimal incentiveAmount;
    }

    @Data
    public static class BrandSlabSummary {
        private String brand;
        private List<IncentiveSlabResponse> slabs;
    }

    @Data
    public static class CreditRequest {
        @NotNull private Integer targetMonth;
        @NotNull private Integer targetYear;
    }

    @Data
    public static class IncentiveCreditResponse {
        private UUID id;
        private UUID salesPersonId;
        private String salesPersonName;
        private String salesPersonPhone;
        private String brand;
        private int targetMonth;
        private int targetYear;
        private BigDecimal targetValue;
        private BigDecimal achievedValue;
        private BigDecimal achievementPct;
        private BigDecimal incentiveAmount;
        private String status;
        private Instant creditedAt;
        private String notes;
    }

    @Data
    public static class CreditSummary {
        private int month;
        private int year;
        private List<IncentiveCreditResponse> credits;
        private BigDecimal totalIncentive;
        private long totalPending;
        private long totalCredited;
    }

    @Data
    public static class BrandIncentiveCard {
        private String brand;
        private BigDecimal targetValue;
        private BigDecimal achievedValue;
        private BigDecimal achievementPct;
        private String achievementStatus;
        private BigDecimal earnedIncentive;
        private BigDecimal nextTierIncentive;
        private BigDecimal gapToNextTier;
        private BigDecimal nextTierTargetPct;
        private List<IncentiveSlabResponse> slabs;
        private boolean credited;
    }

    @Data
    public static class MyIncentiveView {
        private int month;
        private int year;
        private BigDecimal totalEarned;
        private BigDecimal totalPotential;
        private List<BrandIncentiveCard> brands;
    }
}
