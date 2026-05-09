package com.distroiq.api.module.report.service;

import com.distroiq.api.module.customer.entity.Customer;
import com.distroiq.api.module.customer.repository.CustomerRepository;
import com.distroiq.api.module.order.entity.Order;
import com.distroiq.api.module.order.entity.OrderItem;
import com.distroiq.api.module.order.entity.Payment;
import com.distroiq.api.module.order.repository.OrderRepository;
import com.distroiq.api.module.order.repository.PaymentRepository;
import com.distroiq.api.module.purchase.entity.PurchaseEntry;
import com.distroiq.api.module.purchase.repository.PurchaseEntryRepository;
import com.distroiq.api.module.report.dto.ReportDtos;
import com.distroiq.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final CustomerRepository customerRepository;
    private final PurchaseEntryRepository purchaseEntryRepository;

    // ─── 0. Sales Trend ──────────────────────────────────────────────────────

    public ReportDtos.SalesTrendResponse getSalesTrend(UUID tenantId, LocalDate from, LocalDate to) {
        List<Order> orders = orderRepository.findAll().stream()
                .filter(o -> o.getTenant().getId().equals(tenantId))
                .filter(o -> !o.getOrderDate().isBefore(from) && !o.getOrderDate().isAfter(to))
                .filter(o -> o.getStatus() != Order.OrderStatus.CANCELLED)
                .collect(Collectors.toList());

        Map<LocalDate, BigDecimal> byDate = orders.stream()
                .collect(Collectors.groupingBy(Order::getOrderDate,
                        Collectors.reducing(BigDecimal.ZERO, Order::getTotalAmount, BigDecimal::add)));

        List<ReportDtos.DailyRevenue> breakdown = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            breakdown.add(new ReportDtos.DailyRevenue(d, byDate.getOrDefault(d, BigDecimal.ZERO)));
        }

        return ReportDtos.SalesTrendResponse.builder().dailyBreakdown(breakdown).build();
    }

    // ─── 1. Aging Report ─────────────────────────────────────────────────────

    public ReportDtos.AgingReportResponse getAgingReport(UUID tenantId) {
        LocalDate today = LocalDate.now();

        // Fetch all customers with tenant
        List<Customer> customers = customerRepository.findAll().stream()
                .filter(c -> c.getTenant().getId().equals(tenantId) && c.isActive())
                .collect(Collectors.toList());

        List<ReportDtos.AgingRow> rows = new ArrayList<>();

        for (Customer customer : customers) {
            List<Order> unpaidOrders = orderRepository.findUnpaidOrdersByCustomer(tenantId, customer.getId(), Order.OrderStatus.CANCELLED);
            if (unpaidOrders.isEmpty()) continue;

            BigDecimal b0to30 = BigDecimal.ZERO;
            BigDecimal b31to60 = BigDecimal.ZERO;
            BigDecimal b61to90 = BigDecimal.ZERO;
            BigDecimal b90plus = BigDecimal.ZERO;

            for (Order order : unpaidOrders) {
                long daysOld = ChronoUnit.DAYS.between(order.getOrderDate(), today);
                BigDecimal balance = order.getBalanceAmount();

                if (daysOld <= 30) {
                    b0to30 = b0to30.add(balance);
                } else if (daysOld <= 60) {
                    b31to60 = b31to60.add(balance);
                } else if (daysOld <= 90) {
                    b61to90 = b61to90.add(balance);
                } else {
                    b90plus = b90plus.add(balance);
                }
            }

            BigDecimal totalOutstanding = b0to30.add(b31to60).add(b61to90).add(b90plus);

            rows.add(ReportDtos.AgingRow.builder()
                    .customerId(customer.getId())
                    .businessName(customer.getBusinessName())
                    .phone(customer.getPhone())
                    .totalOutstanding(totalOutstanding)
                    .bucket0to30(b0to30)
                    .bucket31to60(b31to60)
                    .bucket61to90(b61to90)
                    .bucket90plus(b90plus)
                    .build());
        }

        // Sort by totalOutstanding descending
        rows.sort(Comparator.comparing(ReportDtos.AgingRow::getTotalOutstanding).reversed());

        // Summary totals
        BigDecimal sumTotal = rows.stream().map(ReportDtos.AgingRow::getTotalOutstanding).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum0to30 = rows.stream().map(ReportDtos.AgingRow::getBucket0to30).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum31to60 = rows.stream().map(ReportDtos.AgingRow::getBucket31to60).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum61to90 = rows.stream().map(ReportDtos.AgingRow::getBucket61to90).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum90plus = rows.stream().map(ReportDtos.AgingRow::getBucket90plus).reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.AgingReportResponse.builder()
                .rows(rows)
                .summaryTotalOutstanding(sumTotal)
                .summaryBucket0to30(sum0to30)
                .summaryBucket31to60(sum31to60)
                .summaryBucket61to90(sum61to90)
                .summaryBucket90plus(sum90plus)
                .totalCustomers(rows.size())
                .build();
    }

    // ─── 2. Sales Analysis ────────────────────────────────────────────────────

    public ReportDtos.SalesAnalysisResponse getSalesAnalysis(
            UUID tenantId, LocalDate from, LocalDate to, ReportDtos.SalesGroupBy groupBy) {

        List<Order> orders = orderRepository.findByTenantAndDateRange(tenantId, from, to, Order.OrderStatus.CANCELLED);

        // Daily trend (always computed)
        Map<LocalDate, List<Order>> byDate = orders.stream()
                .collect(Collectors.groupingBy(Order::getOrderDate));
        List<ReportDtos.DailyTrendPoint> dailyTrend = byDate.entrySet().stream()
                .map(e -> ReportDtos.DailyTrendPoint.builder()
                        .date(e.getKey())
                        .totalSales(e.getValue().stream()
                                .map(Order::getTotalAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add))
                        .build())
                .sorted(Comparator.comparing(ReportDtos.DailyTrendPoint::getDate))
                .collect(Collectors.toList());

        BigDecimal grandTotal = orders.stream()
                .map(Order::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        ReportDtos.SalesAnalysisResponse.SalesAnalysisResponseBuilder builder =
                ReportDtos.SalesAnalysisResponse.builder()
                        .from(from)
                        .to(to)
                        .groupBy(groupBy)
                        .dailyTrend(dailyTrend)
                        .grandTotal(grandTotal)
                        .totalOrders(orders.size());

        switch (groupBy) {
            case SALESMAN -> {
                Map<UUID, List<Order>> bySalesman = orders.stream()
                        .collect(Collectors.groupingBy(o -> o.getSalesPerson().getId()));
                List<ReportDtos.SalesmanRow> rows = bySalesman.entrySet().stream()
                        .map(e -> {
                            Order sample = e.getValue().get(0);
                            BigDecimal total = e.getValue().stream()
                                    .map(Order::getTotalAmount)
                                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                            return ReportDtos.SalesmanRow.builder()
                                    .salesPersonId(e.getKey())
                                    .salesPersonName(sample.getSalesPerson().getFullName())
                                    .totalSales(total)
                                    .orderCount(e.getValue().size())
                                    .totalOrders(e.getValue().size())
                                    .build();
                        })
                        .sorted(Comparator.comparing(ReportDtos.SalesmanRow::getTotalSales).reversed())
                        .collect(Collectors.toList());
                builder.salesmanRows(rows);
            }
            case PRODUCT -> {
                List<OrderItem> items = orderRepository.findItemsByTenantAndDateRange(tenantId, from, to, Order.OrderStatus.CANCELLED);
                Map<UUID, List<OrderItem>> byProduct = items.stream()
                        .collect(Collectors.groupingBy(i -> i.getProduct().getId()));
                List<ReportDtos.ProductRow> rows = byProduct.entrySet().stream()
                        .map(e -> {
                            OrderItem sample = e.getValue().get(0);
                            int qty = e.getValue().stream().mapToInt(OrderItem::getQuantity).sum();
                            BigDecimal revenue = e.getValue().stream()
                                    .map(OrderItem::getLineTotal)
                                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                            return ReportDtos.ProductRow.builder()
                                    .productId(e.getKey())
                                    .productName(sample.getProduct().getName())
                                    .brand(sample.getProduct().getBrand())
                                    .qtySold(qty)
                                    .revenue(revenue)
                                    .build();
                        })
                        .sorted(Comparator.comparing(ReportDtos.ProductRow::getRevenue).reversed())
                        .collect(Collectors.toList());
                builder.productRows(rows);
            }
            case CATEGORY -> {
                List<OrderItem> items = orderRepository.findItemsByTenantAndDateRange(tenantId, from, to, Order.OrderStatus.CANCELLED);
                Map<String, List<OrderItem>> byCategory = items.stream()
                        .collect(Collectors.groupingBy(i -> {
                            String cat = i.getProduct().getCategory();
                            return cat != null ? cat : "Uncategorized";
                        }));
                List<ReportDtos.CategoryRow> rows = byCategory.entrySet().stream()
                        .map(e -> {
                            int qty = e.getValue().stream().mapToInt(OrderItem::getQuantity).sum();
                            BigDecimal revenue = e.getValue().stream()
                                    .map(OrderItem::getLineTotal)
                                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                            return ReportDtos.CategoryRow.builder()
                                    .category(e.getKey())
                                    .qtySold(qty)
                                    .revenue(revenue)
                                    .build();
                        })
                        .sorted(Comparator.comparing(ReportDtos.CategoryRow::getRevenue).reversed())
                        .collect(Collectors.toList());
                builder.categoryRows(rows);
            }
        }

        return builder.build();
    }

    // ─── 3a. Customer Ledger ─────────────────────────────────────────────────

    public ReportDtos.CustomerLedgerResponse getCustomerLedger(
            UUID tenantId, UUID customerId, LocalDate from, LocalDate to) {

        Customer customer = customerRepository.findByIdAndTenantId(customerId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId.toString()));

        // Opening balance: net of all debit (orders) - credit (payments) BEFORE 'from'
        List<Order> ordersBeforeFrom = orderRepository.findByTenantAndCustomerBeforeDate(tenantId, customerId, from, Order.OrderStatus.CANCELLED);
        List<Payment> paymentsBeforeFrom = paymentRepository.findByTenantAndCustomerBeforeDate(tenantId, customerId, from);

        BigDecimal openingDebits = ordersBeforeFrom.stream()
                .map(Order::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal openingCredits = paymentsBeforeFrom.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal openingBalance = openingDebits.subtract(openingCredits);

        // Period orders and payments
        List<Order> periodOrders = orderRepository.findByTenantAndCustomerAndDateRange(tenantId, customerId, from, to, Order.OrderStatus.CANCELLED);
        List<Payment> periodPayments = paymentRepository.findByTenantAndCustomerAndDateRange(tenantId, customerId, from, to);

        // Build combined ledger entries
        List<ReportDtos.LedgerEntry> entries = new ArrayList<>();

        for (Order o : periodOrders) {
            entries.add(ReportDtos.LedgerEntry.builder()
                    .date(o.getOrderDate())
                    .description("Order #" + o.getOrderNumber())
                    .debit(o.getTotalAmount())
                    .credit(BigDecimal.ZERO)
                    .build());
        }

        for (Payment p : periodPayments) {
            String desc = "Payment - " + p.getPaymentMode().name()
                    + (p.getPaymentMethodName() != null ? " (" + p.getPaymentMethodName() + ")" : "");
            entries.add(ReportDtos.LedgerEntry.builder()
                    .date(p.getCollectionDate())
                    .description(desc)
                    .debit(BigDecimal.ZERO)
                    .credit(p.getAmount())
                    .build());
        }

        // Sort by date, then debits before credits on same day
        entries.sort(Comparator.comparing(ReportDtos.LedgerEntry::getDate)
                .thenComparing(e -> e.getDebit().compareTo(BigDecimal.ZERO) > 0 ? 0 : 1));

        // Compute running balance
        BigDecimal running = openingBalance;
        for (ReportDtos.LedgerEntry entry : entries) {
            running = running.add(entry.getDebit()).subtract(entry.getCredit());
            entry.setRunningBalance(running);
        }

        BigDecimal closingBalance = running;

        return ReportDtos.CustomerLedgerResponse.builder()
                .customerId(customer.getId())
                .businessName(customer.getBusinessName())
                .phone(customer.getPhone())
                .from(from)
                .to(to)
                .openingBalance(openingBalance)
                .closingBalance(closingBalance)
                .entries(entries)
                .build();
    }

    // ─── 3b. Vendor Ledger ────────────────────────────────────────────────────

    public ReportDtos.VendorLedgerResponse getVendorLedger(UUID tenantId, LocalDate from, LocalDate to) {
        List<PurchaseEntry> entries = purchaseEntryRepository.findByTenantAndDateRange(tenantId, from, to);

        Map<String, List<PurchaseEntry>> bySupplier = entries.stream()
                .collect(Collectors.groupingBy(PurchaseEntry::getSupplierName));

        List<ReportDtos.VendorLedgerRow> rows = bySupplier.entrySet().stream()
                .map(e -> {
                    BigDecimal total = e.getValue().stream()
                            .map(PurchaseEntry::getTotalAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    return ReportDtos.VendorLedgerRow.builder()
                            .supplierName(e.getKey())
                            .entryCount(e.getValue().size())
                            .totalPurchases(total)
                            .build();
                })
                .sorted(Comparator.comparing(ReportDtos.VendorLedgerRow::getTotalPurchases).reversed())
                .collect(Collectors.toList());

        BigDecimal grandTotal = rows.stream()
                .map(ReportDtos.VendorLedgerRow::getTotalPurchases)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.VendorLedgerResponse.builder()
                .from(from)
                .to(to)
                .vendors(rows)
                .grandTotal(grandTotal)
                .build();
    }
}
