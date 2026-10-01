package com.stockez.api.module.target.service;

import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.target.dto.TargetDtos;
import com.stockez.api.module.target.entity.SalesTarget;
import com.stockez.api.module.target.repository.SalesTargetRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TargetService {

    private final SalesTargetRepository salesTargetRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;

    /**
     * Create or update a sales target for a given user/month/year.
     * If a target already exists for that combination, it is updated (upsert).
     */
    @Transactional
    public TargetDtos.TargetResponse upsertTarget(UUID tenantId, TargetDtos.UpsertTargetRequest req) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        User user = userRepository.findByIdAndTenantId(req.getUserId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", req.getUserId().toString()));

        Optional<SalesTarget> existing = salesTargetRepository.findByTenantIdAndUserIdAndMonthAndYear(
                tenantId, req.getUserId(), req.getMonth(), req.getYear());

        SalesTarget target;
        if (existing.isPresent()) {
            target = existing.get();
            target.setTargetAmount(req.getTargetAmount());
            target.setTargetOrders(req.getTargetOrders());
        } else {
            target = SalesTarget.builder()
                    .tenant(tenant)
                    .user(user)
                    .month(req.getMonth())
                    .year(req.getYear())
                    .targetAmount(req.getTargetAmount())
                    .targetOrders(req.getTargetOrders())
                    .build();
        }

        target = salesTargetRepository.save(target);
        return toResponse(target);
    }

    /**
     * List all targets for a given month/year with achievement data.
     */
    @Transactional(readOnly = true)
    public TargetDtos.TargetListResponse listTargets(UUID tenantId, int month, int year) {
        List<SalesTarget> targets = salesTargetRepository.findByTenantIdAndMonthAndYear(tenantId, month, year);

        List<TargetDtos.TargetResponse> rows = targets.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        BigDecimal totalTarget = rows.stream()
                .map(TargetDtos.TargetResponse::getTargetAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalAchieved = rows.stream()
                .map(TargetDtos.TargetResponse::getAchievedAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        double overallPercent = totalTarget.compareTo(BigDecimal.ZERO) == 0
                ? 0.0
                : totalAchieved.divide(totalTarget, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .doubleValue();

        return TargetDtos.TargetListResponse.builder()
                .month(month)
                .year(year)
                .targets(rows)
                .totalTargetAmount(totalTarget)
                .totalAchievedAmount(totalAchieved)
                .overallAchievementPercent(overallPercent)
                .build();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private TargetDtos.TargetResponse toResponse(SalesTarget target) {
        // Compute achievement by fetching orders for this salesperson in the target month/year
        YearMonth ym = YearMonth.of(target.getYear(), target.getMonth());
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();
        List<Order> orders = orderRepository.findByTenantAndSalesPersonAndMonthYear(
                target.getTenant().getId(),
                target.getUser().getId(),
                from,
                to,
                Order.OrderStatus.CANCELLED);

        BigDecimal achievedAmount = orders.stream()
                .map(Order::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int achievedOrders = orders.size();

        double achievementPercent = target.getTargetAmount().compareTo(BigDecimal.ZERO) == 0
                ? 0.0
                : achievedAmount.divide(target.getTargetAmount(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .doubleValue();

        double orderAchievementPercent = target.getTargetOrders() == 0
                ? 0.0
                : (achievedOrders * 100.0) / target.getTargetOrders();

        return TargetDtos.TargetResponse.builder()
                .id(target.getId())
                .userId(target.getUser().getId())
                .userName(target.getUser().getFullName())
                .userRole(target.getUser().getRole().name())
                .month(target.getMonth())
                .year(target.getYear())
                .targetAmount(target.getTargetAmount())
                .targetOrders(target.getTargetOrders())
                .achievedAmount(achievedAmount)
                .achievedOrders(achievedOrders)
                .achievementPercent(achievementPercent)
                .orderAchievementPercent(orderAchievementPercent)
                .build();
    }
}
