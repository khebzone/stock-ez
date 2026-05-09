package com.distroiq.api.module.expense.repository;

import com.distroiq.api.module.expense.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    List<Expense> findByTenantIdAndExpenseDateBetweenOrderByExpenseDateDescCreatedAtDesc(
            UUID tenantId, LocalDate from, LocalDate to);

    List<Expense> findByTenantIdAndCategoryIdAndExpenseDateBetweenOrderByExpenseDateDescCreatedAtDesc(
            UUID tenantId, UUID categoryId, LocalDate from, LocalDate to);

    Optional<Expense> findByIdAndTenantId(UUID id, UUID tenantId);

    @Query("SELECT SUM(e.amount) FROM Expense e WHERE e.tenant.id = :tenantId AND e.expenseDate = :date")
    BigDecimal sumByTenantIdAndDate(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date);

    @Query("SELECT SUM(e.amount) FROM Expense e WHERE e.tenant.id = :tenantId AND e.expenseDate BETWEEN :from AND :to")
    BigDecimal sumByTenantIdAndDateBetween(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT e.category.name, SUM(e.amount), COUNT(e) FROM Expense e " +
           "WHERE e.tenant.id = :tenantId AND e.expenseDate BETWEEN :from AND :to " +
           "GROUP BY e.category.name ORDER BY SUM(e.amount) DESC")
    List<Object[]> summariseByCategory(@Param("tenantId") UUID tenantId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
