package com.stockez.api.module.dayclosure.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class DayClosureDtos {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TodayCounterResponse {
        private LocalDate closureDate;
        private BigDecimal openingCash;
        private BigDecimal totalCash;
        private BigDecimal totalUpi;
        private BigDecimal totalCheque;
        private BigDecimal totalNeft;
        private BigDecimal totalCollected;
        private BigDecimal expectedCashClosing;
        private boolean alreadyClosed;
        private DayClosureResponse existingClosure;          // nullable — present only when alreadyClosed = true
        private List<CollectorSummary> collectors;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CollectorSummary {
        private String collectorName;
        private String role;
        private BigDecimal cashAmount;
        private BigDecimal upiAmount;
        private BigDecimal chequeAmount;
        private BigDecimal neftAmount;
        private BigDecimal totalAmount;
        private int submittedCount;
        private int totalCount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CloseDayRequest {
        @NotNull(message = "physicalCashEntered is required")
        @Min(value = 0, message = "physicalCashEntered must be zero or positive")
        private BigDecimal physicalCashEntered;

        private String notes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DayClosureResponse {
        private UUID id;
        private LocalDate closureDate;
        private BigDecimal openingCash;
        private BigDecimal totalCash;
        private BigDecimal totalUpi;
        private BigDecimal totalCheque;
        private BigDecimal totalNeft;
        private BigDecimal totalCollected;
        private BigDecimal expectedCashClosing;
        private BigDecimal physicalCashEntered;
        private BigDecimal difference;
        private String status;
        private String notes;
        private String closedBy;
        private Instant closedAt;
        private Instant createdAt;
    }
}
