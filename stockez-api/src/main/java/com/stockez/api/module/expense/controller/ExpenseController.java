package com.stockez.api.module.expense.controller;

import com.stockez.api.module.expense.dto.ExpenseDtos;
import com.stockez.api.module.expense.service.ExpenseService;
import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/expenses")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Expenses", description = "Office expense tracking")
public class ExpenseController {

    private final ExpenseService expenseService;

    @GetMapping("/categories")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('EXPENSES_VIEW')")
    public ResponseEntity<ApiResponse<List<ExpenseDtos.CategoryResponse>>> getCategories(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(expenseService.getCategories(tenantId)));
    }

    @PostMapping("/categories")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ExpenseDtos.CategoryResponse>> createCategory(
            @Valid @RequestBody ExpenseDtos.CreateCategoryRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(expenseService.createCategory(request, tenantId), "Category created"));
    }

    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteCategory(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        expenseService.deleteCategory(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Category removed"));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('EXPENSES_VIEW')")
    public ResponseEntity<ApiResponse<List<ExpenseDtos.ExpenseResponse>>> getExpenses(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID categoryId) {
        LocalDate effectiveTo = to != null ? to : LocalDate.now();
        LocalDate effectiveFrom = from != null ? from : effectiveTo.withDayOfMonth(1);
        return ResponseEntity.ok(ApiResponse.success(expenseService.getExpenses(tenantId, effectiveFrom, effectiveTo, categoryId)));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('EXPENSES_VIEW')")
    public ResponseEntity<ApiResponse<ExpenseDtos.ExpenseSummary>> getSummary(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(expenseService.getSummary(tenantId)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('EXPENSES_CREATE')")
    public ResponseEntity<ApiResponse<ExpenseDtos.ExpenseResponse>> create(
            @Valid @RequestBody ExpenseDtos.CreateExpenseRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(expenseService.createExpense(request, tenantId, userId), "Expense recorded"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('EXPENSES_CREATE')")
    public ResponseEntity<ApiResponse<ExpenseDtos.ExpenseResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody ExpenseDtos.UpdateExpenseRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(expenseService.updateExpense(id, request, tenantId), "Expense updated"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('EXPENSES_DELETE')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        expenseService.deleteExpense(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Expense deleted"));
    }
}
