package com.stockez.api.module.expense.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class ExpenseDtos {

    @Data
    public static class CreateCategoryRequest {
        @NotBlank(message = "Category name is required")
        @Size(max = 100)
        private String name;
    }

    @Data
    public static class CategoryResponse {
        private UUID id;
        private String name;
        private boolean active;
    }

    @Data
    public static class CreateExpenseRequest {
        @NotNull(message = "Date is required")
        private LocalDate expenseDate;

        @NotNull(message = "Category is required")
        private UUID categoryId;

        @Size(max = 500)
        private String description;

        @NotNull(message = "Amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
        private BigDecimal amount;

        @NotBlank(message = "Payment mode is required")
        private String paymentMode;

        @Size(max = 100)
        private String referenceNumber;

        @Size(max = 2000)
        private String notes;
    }

    @Data
    public static class UpdateExpenseRequest {
        @NotNull
        private LocalDate expenseDate;

        @NotNull
        private UUID categoryId;

        @Size(max = 500)
        private String description;

        @NotNull
        @DecimalMin(value = "0.01")
        private BigDecimal amount;

        @NotBlank
        private String paymentMode;

        @Size(max = 100)
        private String referenceNumber;

        @Size(max = 2000)
        private String notes;
    }

    @Data
    public static class ExpenseResponse {
        private UUID id;
        private LocalDate expenseDate;
        private UUID categoryId;
        private String categoryName;
        private String description;
        private BigDecimal amount;
        private String paymentMode;
        private String referenceNumber;
        private String recordedByName;
        private String notes;
        private Instant createdAt;
    }

    @Data
    public static class CategorySummaryItem {
        private String categoryName;
        private BigDecimal totalAmount;
        private long count;
    }

    @Data
    public static class ExpenseSummary {
        private BigDecimal todayTotal;
        private BigDecimal thisMonthTotal;
        private BigDecimal thisYearTotal;
        private List<CategorySummaryItem> byCategory;
    }
}
