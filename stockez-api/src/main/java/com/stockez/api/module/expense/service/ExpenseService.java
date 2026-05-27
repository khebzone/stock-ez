package com.stockez.api.module.expense.service;

import com.stockez.api.module.expense.dto.ExpenseDtos;
import com.stockez.api.module.expense.entity.Expense;
import com.stockez.api.module.expense.entity.ExpenseCategory;
import com.stockez.api.module.expense.repository.ExpenseCategoryRepository;
import com.stockez.api.module.expense.repository.ExpenseRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ExpenseService {

    private static final List<String> DEFAULT_CATEGORIES = Arrays.asList(
            "Vehicle Expense", "Salary", "Tea & Refreshments", "Office Supplies",
            "Rent", "Electricity & Utilities", "Travel & Fuel",
            "Maintenance & Repairs", "Miscellaneous"
    );

    private final ExpenseRepository expenseRepository;
    private final ExpenseCategoryRepository categoryRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<ExpenseDtos.CategoryResponse> getCategories(UUID tenantId) {
        if (categoryRepository.countByTenantId(tenantId) == 0) {
            seedDefaultCategories(tenantId);
        }
        return categoryRepository.findByTenantIdAndActiveTrueOrderByNameAsc(tenantId)
                .stream().map(this::toCategoryResponse).collect(Collectors.toList());
    }

    public ExpenseDtos.CategoryResponse createCategory(ExpenseDtos.CreateCategoryRequest req, UUID tenantId) {
        if (categoryRepository.existsByTenantIdAndNameIgnoreCase(tenantId, req.getName())) {
            throw new BusinessException("Category '" + req.getName() + "' already exists", "DUPLICATE_CATEGORY");
        }
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        ExpenseCategory cat = ExpenseCategory.builder()
                .tenant(tenant)
                .name(req.getName())
                .build();
        return toCategoryResponse(categoryRepository.save(cat));
    }

    public void deleteCategory(UUID id, UUID tenantId) {
        ExpenseCategory cat = categoryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("ExpenseCategory", id.toString()));
        cat.setActive(false);
        categoryRepository.save(cat);
    }

    @Transactional(readOnly = true)
    public List<ExpenseDtos.ExpenseResponse> getExpenses(UUID tenantId, LocalDate from, LocalDate to, UUID categoryId) {
        List<Expense> list = categoryId != null
                ? expenseRepository.findByTenantIdAndCategoryIdAndExpenseDateBetweenOrderByExpenseDateDescCreatedAtDesc(tenantId, categoryId, from, to)
                : expenseRepository.findByTenantIdAndExpenseDateBetweenOrderByExpenseDateDescCreatedAtDesc(tenantId, from, to);
        return list.stream().map(this::toResponse).collect(Collectors.toList());
    }

    public ExpenseDtos.ExpenseResponse createExpense(ExpenseDtos.CreateExpenseRequest req, UUID tenantId, UUID userId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        ExpenseCategory category = categoryRepository.findByIdAndTenantId(req.getCategoryId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("ExpenseCategory", req.getCategoryId().toString()));
        User recordedBy = userRepository.findById(userId).orElse(null);

        Expense expense = Expense.builder()
                .tenant(tenant)
                .expenseDate(req.getExpenseDate())
                .category(category)
                .description(req.getDescription())
                .amount(req.getAmount())
                .paymentMode(req.getPaymentMode())
                .referenceNumber(req.getReferenceNumber())
                .recordedBy(recordedBy)
                .notes(req.getNotes())
                .build();
        Expense saved = expenseRepository.save(expense);
        auditService.record(tenantId, "EXPENSE", saved.getId(), "CREATED",
                "Expense ₹" + saved.getAmount().toPlainString() + " (" + category.getName() + ") recorded for " + req.getExpenseDate());
        return toResponse(saved);
    }

    public ExpenseDtos.ExpenseResponse updateExpense(UUID id, ExpenseDtos.UpdateExpenseRequest req, UUID tenantId) {
        Expense expense = expenseRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id.toString()));
        ExpenseCategory category = categoryRepository.findByIdAndTenantId(req.getCategoryId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("ExpenseCategory", req.getCategoryId().toString()));

        expense.setExpenseDate(req.getExpenseDate());
        expense.setCategory(category);
        expense.setDescription(req.getDescription());
        expense.setAmount(req.getAmount());
        expense.setPaymentMode(req.getPaymentMode());
        expense.setReferenceNumber(req.getReferenceNumber());
        expense.setNotes(req.getNotes());
        Expense saved = expenseRepository.save(expense);
        auditService.record(tenantId, "EXPENSE", saved.getId(), "UPDATED",
                "Expense updated to ₹" + saved.getAmount().toPlainString() + " (" + category.getName() + ")");
        return toResponse(saved);
    }

    public void deleteExpense(UUID id, UUID tenantId) {
        Expense expense = expenseRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id.toString()));
        expenseRepository.delete(expense);
        auditService.record(tenantId, "EXPENSE", expense.getId(), "DELETED",
                "Expense ₹" + expense.getAmount().toPlainString() + " (" + expense.getCategory().getName() + ") deleted");
    }

    @Transactional(readOnly = true)
    public ExpenseDtos.ExpenseSummary getSummary(UUID tenantId) {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate yearStart = today.withDayOfYear(1);

        BigDecimal todayTotal = expenseRepository.sumByTenantIdAndDate(tenantId, today);
        BigDecimal monthTotal = expenseRepository.sumByTenantIdAndDateBetween(tenantId, monthStart, today);
        BigDecimal yearTotal = expenseRepository.sumByTenantIdAndDateBetween(tenantId, yearStart, today);

        List<Object[]> rows = expenseRepository.summariseByCategory(tenantId, monthStart, today);
        List<ExpenseDtos.CategorySummaryItem> byCategory = rows.stream().map(r -> {
            ExpenseDtos.CategorySummaryItem item = new ExpenseDtos.CategorySummaryItem();
            item.setCategoryName((String) r[0]);
            item.setTotalAmount((BigDecimal) r[1]);
            item.setCount((Long) r[2]);
            return item;
        }).collect(Collectors.toList());

        ExpenseDtos.ExpenseSummary summary = new ExpenseDtos.ExpenseSummary();
        summary.setTodayTotal(todayTotal != null ? todayTotal : BigDecimal.ZERO);
        summary.setThisMonthTotal(monthTotal != null ? monthTotal : BigDecimal.ZERO);
        summary.setThisYearTotal(yearTotal != null ? yearTotal : BigDecimal.ZERO);
        summary.setByCategory(byCategory);
        return summary;
    }

    private void seedDefaultCategories(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return;
        for (String name : DEFAULT_CATEGORIES) {
            ExpenseCategory cat = ExpenseCategory.builder().tenant(tenant).name(name).build();
            categoryRepository.save(cat);
        }
    }

    private ExpenseDtos.CategoryResponse toCategoryResponse(ExpenseCategory c) {
        ExpenseDtos.CategoryResponse res = new ExpenseDtos.CategoryResponse();
        res.setId(c.getId());
        res.setName(c.getName());
        res.setActive(c.isActive());
        return res;
    }

    private ExpenseDtos.ExpenseResponse toResponse(Expense e) {
        ExpenseDtos.ExpenseResponse res = new ExpenseDtos.ExpenseResponse();
        res.setId(e.getId());
        res.setExpenseDate(e.getExpenseDate());
        res.setCategoryId(e.getCategory().getId());
        res.setCategoryName(e.getCategory().getName());
        res.setDescription(e.getDescription());
        res.setAmount(e.getAmount());
        res.setPaymentMode(e.getPaymentMode());
        res.setReferenceNumber(e.getReferenceNumber());
        res.setRecordedByName(e.getRecordedBy() != null ? e.getRecordedBy().getFullName() : null);
        res.setNotes(e.getNotes());
        res.setCreatedAt(e.getCreatedAt());
        return res;
    }
}
