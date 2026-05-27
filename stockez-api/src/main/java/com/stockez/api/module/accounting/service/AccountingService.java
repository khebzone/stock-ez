package com.stockez.api.module.accounting.service;

import com.stockez.api.module.accounting.dto.AccountingDtos;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.Payment;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AccountingService {

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;

    public AccountingDtos.SalesReportResponse getSalesReport(UUID tenantId, LocalDate from, LocalDate to) {
        // In real production, this would use a native query or specialized reporting table
        // For simplicity, we are fetching records for the tenant
        List<Order> orders = orderRepository.findAll().stream()
                .filter(o -> o.getTenant().getId().equals(tenantId))
                .filter(o -> !o.getOrderDate().isBefore(from) && !o.getOrderDate().isAfter(to))
                .filter(o -> o.getStatus() != Order.OrderStatus.CANCELLED)
                .collect(Collectors.toList());

        BigDecimal totalSales = orders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalGst = orders.stream().map(Order::getTotalGst).reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<LocalDate, List<Order>> byDate = orders.stream().collect(Collectors.groupingBy(Order::getOrderDate));
        List<AccountingDtos.DailySalesSummary> trends = byDate.entrySet().stream()
                .map(e -> {
                    AccountingDtos.DailySalesSummary s = new AccountingDtos.DailySalesSummary();
                    s.setDate(e.getKey());
                    s.setTotalValue(e.getValue().stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
                    s.setOrderCount(e.getValue().size());
                    return s;
                })
                .sorted(Comparator.comparing(AccountingDtos.DailySalesSummary::getDate))
                .collect(Collectors.toList());

        AccountingDtos.SalesReportResponse res = new AccountingDtos.SalesReportResponse();
        res.setFromDate(from);
        res.setToDate(to);
        res.setTotalSales(totalSales);
        res.setTotalGst(totalGst);
        res.setTotalOrders(orders.size());
        res.setDailyTrends(trends);
        // Top products calculation would involve iterating OrderItems
        return res;
    }

    public AccountingDtos.CollectionReportResponse getCollectionReport(UUID tenantId, LocalDate from, LocalDate to) {
        List<Payment> payments = paymentRepository.findAll().stream()
                .filter(p -> p.getTenant().getId().equals(tenantId))
                .filter(p -> !p.getCollectionDate().isBefore(from) && !p.getCollectionDate().isAfter(to))
                .collect(Collectors.toList());

        BigDecimal total = payments.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal> modeSummary = payments.stream()
                .collect(Collectors.groupingBy(p -> p.getPaymentMode().name(),
                        Collectors.mapping(Payment::getAmount, Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));

        Map<UUID, List<Payment>> byStaff = payments.stream()
                .collect(Collectors.groupingBy(p -> p.getCollectedBy().getId()));

        List<AccountingDtos.PersonCollectionSummary> staffSummaries = byStaff.entrySet().stream()
                .map(e -> {
                    AccountingDtos.PersonCollectionSummary ps = new AccountingDtos.PersonCollectionSummary();
                    ps.setPersonName(e.getValue().get(0).getCollectedBy().getFullName());
                    ps.setRole(e.getValue().get(0).getCollectedBy().getRole().name());
                    ps.setTotalCollected(e.getValue().stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
                    return ps;
                })
                .collect(Collectors.toList());

        AccountingDtos.CollectionReportResponse res = new AccountingDtos.CollectionReportResponse();
        res.setFromDate(from);
        res.setToDate(to);
        res.setTotalCollected(total);
        res.setModeSummary(modeSummary);
        res.setStaffSummary(staffSummaries);
        return res;
    }
}
