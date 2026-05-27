package com.stockez.api.module.expense.repository;

import com.stockez.api.module.expense.entity.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExpenseCategoryRepository extends JpaRepository<ExpenseCategory, UUID> {

    List<ExpenseCategory> findByTenantIdAndActiveTrueOrderByNameAsc(UUID tenantId);

    boolean existsByTenantIdAndNameIgnoreCase(UUID tenantId, String name);

    Optional<ExpenseCategory> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantId(UUID tenantId);
}
