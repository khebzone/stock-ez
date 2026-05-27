package com.stockez.api.module.report.service;

import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.customer.repository.CustomerRepository;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.OrderItem;
import com.stockez.api.module.order.entity.Payment;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.purchase.entity.PurchaseEntry;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.repository.PurchaseEntryRepository;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.report.dto.ReportDtos;
import com.stockez.common.exception.ResourceNotFoundException;
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
    private final StockBatchRepository stockBatchRepository;

    // ─── 0. Sales Trend ──────────────────────────────────────────────────────

    public ReportDtos.SalesTrendResponse getSalesTrend(UUID tenantId, LocalDate from, LocalDate to) {
        List<Order> orders = orderRepository.findByTenantAndDateRange(tenantId, from, to, Order.OrderStatus.CANCELLED);

        Map<LocalDate, List<Order>> byDate = orders.stream()
                .collect(Collectors.groupingBy(Order::getOrderDate));

        List<ReportDtos.DailyRevenue> breakdown = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            List<Order> day = byDate.getOrDefault(d, Collections.emptyList());
            if (day.isEmpty()) continue;
            breakdown.add(ReportDtos.DailyRevenue.builder()
                    .date(d)
                    .orderCount(day.size())
                    .subTotal(day.stream().map(Order::getSubTotal).reduce(BigDecimal.ZERO, BigDecimal::add))
                    .totalGst(day.stream().map(Order::getTotalGst).reduce(BigDecimal.ZERO, BigDecimal::add))
                    .totalAmount(day.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add))
                    .build());
        }

        int totalOrders = orders.size();
        BigDecimal totalRevenue = orders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalGst = orders.stream().map(Order::getTotalGst).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal avgOrderValue = totalOrders > 0
                ? totalRevenue.divide(BigDecimal.valueOf(totalOrders), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return ReportDtos.SalesTrendResponse.builder()
                .dailyBreakdown(breakdown)
                .totalOrders(totalOrders)
                .totalRevenue(totalRevenue)
                .totalGst(totalGst)
                .avgOrderValue(avgOrderValue)
                .build();
    }

    // ─── 0b. Collection Report ───────────────────────────────────────────────

    public ReportDtos.CollectionReportResponse getCollectionReport(UUID tenantId, LocalDate from, LocalDate to) {
        List<Payment> payments = paymentRepository.findByTenantAndDateRange(tenantId, from, to);

        Map<LocalDate, List<Payment>> byDate = payments.stream()
                .collect(Collectors.groupingBy(Payment::getCollectionDate));

        List<ReportDtos.DailyCollection> breakdown = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            List<Payment> day = byDate.getOrDefault(d, Collections.emptyList());
            if (day.isEmpty()) continue;
            BigDecimal cash = sumByMode(day, Payment.PaymentMode.CASH);
            BigDecimal upi  = sumByMode(day, Payment.PaymentMode.UPI);
            BigDecimal bank = day.stream()
                    .filter(p -> p.getPaymentMode() != Payment.PaymentMode.CASH
                              && p.getPaymentMode() != Payment.PaymentMode.UPI
                              && p.getPaymentMode() != Payment.PaymentMode.CREDIT)
                    .map(Payment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal total = day.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            breakdown.add(ReportDtos.DailyCollection.builder()
                    .date(d)
                    .paymentCount(day.size())
                    .cashAmount(cash)
                    .upiAmount(upi)
                    .bankTransferAmount(bank)
                    .totalAmount(total)
                    .build());
        }

        BigDecimal totalCollected = payments.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCash = sumByMode(payments, Payment.PaymentMode.CASH);
        BigDecimal totalDigital = totalCollected.subtract(totalCash);
        BigDecimal totalUncleared = payments.stream()
                .filter(p -> !p.isCleared())
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.CollectionReportResponse.builder()
                .dailyBreakdown(breakdown)
                .totalCollected(totalCollected)
                .totalCash(totalCash)
                .totalDigital(totalDigital)
                .totalUncleared(totalUncleared)
                .build();
    }

    private BigDecimal sumByMode(List<Payment> payments, Payment.PaymentMode mode) {
        return payments.stream()
                .filter(p -> p.getPaymentMode() == mode)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // ─── 1. Aging Report ─────────────────────────────────────────────────────

    public ReportDtos.AgingReportResponse getAgingReport(UUID tenantId) {
        LocalDate today = LocalDate.now();

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
                if (daysOld <= 30)       b0to30  = b0to30.add(balance);
                else if (daysOld <= 60)  b31to60 = b31to60.add(balance);
                else if (daysOld <= 90)  b61to90 = b61to90.add(balance);
                else                     b90plus = b90plus.add(balance);
            }

            rows.add(ReportDtos.AgingRow.builder()
                    .customerId(customer.getId())
                    .businessName(customer.getBusinessName())
                    .phone(customer.getPhone())
                    .totalOutstanding(b0to30.add(b31to60).add(b61to90).add(b90plus))
                    .bucket0to30(b0to30)
                    .bucket31to60(b31to60)
                    .bucket61to90(b61to90)
                    .bucket90plus(b90plus)
                    .build());
        }

        rows.sort(Comparator.comparing(ReportDtos.AgingRow::getTotalOutstanding).reversed());

        BigDecimal sumTotal  = rows.stream().map(ReportDtos.AgingRow::getTotalOutstanding).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum0to30  = rows.stream().map(ReportDtos.AgingRow::getBucket0to30).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum31to60 = rows.stream().map(ReportDtos.AgingRow::getBucket31to60).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum61to90 = rows.stream().map(ReportDtos.AgingRow::getBucket61to90).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum90plus = rows.stream().map(ReportDtos.AgingRow::getBucket90plus).reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.AgingReportResponse.builder()
                .rows(rows)
                .summary(ReportDtos.AgingSummary.builder()
                        .totalOutstanding(sumTotal)
                        .bucket0to30(sum0to30)
                        .bucket31to60(sum31to60)
                        .bucket61to90(sum61to90)
                        .bucket90plus(sum90plus)
                        .customerCount(rows.size())
                        .build())
                .build();
    }

    // ─── 2. Sales Analysis ────────────────────────────────────────────────────

    public ReportDtos.SalesAnalysisResponse getSalesAnalysis(
            UUID tenantId, LocalDate from, LocalDate to, ReportDtos.SalesGroupBy groupBy) {

        List<Order> orders = orderRepository.findByTenantAndDateRange(tenantId, from, to, Order.OrderStatus.CANCELLED);

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

        BigDecimal grandTotal = orders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalGst   = orders.stream().map(Order::getTotalGst).reduce(BigDecimal.ZERO, BigDecimal::add);
        long totalOrderCount  = orders.size();

        ReportDtos.SalesAnalysisResponse.SalesAnalysisResponseBuilder builder =
                ReportDtos.SalesAnalysisResponse.builder()
                        .from(from).to(to).groupBy(groupBy)
                        .dailyTrend(dailyTrend)
                        .grandTotal(grandTotal)
                        .totalOrders(totalOrderCount);

        List<ReportDtos.SalesGroupRow> groups = new ArrayList<>();

        switch (groupBy) {
            case SALESMAN -> {
                Map<UUID, List<Order>> bySalesman = orders.stream()
                        .collect(Collectors.groupingBy(o -> o.getSalesPerson().getId()));
                List<ReportDtos.SalesmanRow> rows = bySalesman.entrySet().stream()
                        .map(e -> {
                            Order sample = e.getValue().get(0);
                            BigDecimal total = e.getValue().stream()
                                    .map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
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
                rows.forEach(r -> groups.add(ReportDtos.SalesGroupRow.builder()
                        .name(r.getSalesPersonName())
                        .totalSales(r.getTotalSales())
                        .orderCount(r.getOrderCount())
                        .build()));
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
                                    .map(OrderItem::getLineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
                            return ReportDtos.ProductRow.builder()
                                    .productId(e.getKey())
                                    .productName(sample.getProduct().getName())
                                    .brand(sample.getProduct().getBrand())
                                    .qtySold(qty).revenue(revenue).build();
                        })
                        .sorted(Comparator.comparing(ReportDtos.ProductRow::getRevenue).reversed())
                        .collect(Collectors.toList());
                builder.productRows(rows);
                rows.forEach(r -> groups.add(ReportDtos.SalesGroupRow.builder()
                        .name(r.getProductName())
                        .sub(r.getBrand())
                        .totalSales(r.getRevenue())
                        .qtySold(r.getQtySold())
                        .build()));
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
                                    .map(OrderItem::getLineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
                            return ReportDtos.CategoryRow.builder()
                                    .category(e.getKey()).qtySold(qty).revenue(revenue).build();
                        })
                        .sorted(Comparator.comparing(ReportDtos.CategoryRow::getRevenue).reversed())
                        .collect(Collectors.toList());
                builder.categoryRows(rows);
                rows.forEach(r -> groups.add(ReportDtos.SalesGroupRow.builder()
                        .name(r.getCategory())
                        .totalSales(r.getRevenue())
                        .qtySold(r.getQtySold())
                        .build()));
            }
        }

        BigDecimal avgOrderValue = totalOrderCount > 0
                ? grandTotal.divide(BigDecimal.valueOf(totalOrderCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        String topPerformer     = groups.isEmpty() ? null : groups.get(0).getName();
        BigDecimal topSales     = groups.isEmpty() ? BigDecimal.ZERO : groups.get(0).getTotalSales();

        return builder
                .groups(groups)
                .kpi(ReportDtos.SalesKpi.builder()
                        .totalSales(grandTotal)
                        .totalOrders(totalOrderCount)
                        .avgOrderValue(avgOrderValue)
                        .topPerformer(topPerformer)
                        .topPerformerSales(topSales)
                        .totalGst(totalGst)
                        .build())
                .build();
    }

    // ─── 3a. Customer Ledger ─────────────────────────────────────────────────

    public ReportDtos.CustomerLedgerResponse getCustomerLedger(
            UUID tenantId, UUID customerId, LocalDate from, LocalDate to) {

        Customer customer = customerRepository.findByIdAndTenantId(customerId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId.toString()));

        List<Order> ordersBeforeFrom = orderRepository.findByTenantAndCustomerBeforeDate(tenantId, customerId, from, Order.OrderStatus.CANCELLED);
        List<Payment> paymentsBeforeFrom = paymentRepository.findByTenantAndCustomerBeforeDate(tenantId, customerId, from);

        BigDecimal openingDebits  = ordersBeforeFrom.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal openingCredits = paymentsBeforeFrom.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal openingBalance = openingDebits.subtract(openingCredits);

        List<Order> periodOrders   = orderRepository.findByTenantAndCustomerAndDateRange(tenantId, customerId, from, to, Order.OrderStatus.CANCELLED);
        List<Payment> periodPayments = paymentRepository.findByTenantAndCustomerAndDateRange(tenantId, customerId, from, to);

        List<ReportDtos.LedgerEntry> entries = new ArrayList<>();

        for (Order o : periodOrders) {
            entries.add(ReportDtos.LedgerEntry.builder()
                    .date(o.getOrderDate())
                    .description("Order #" + o.getOrderNumber())
                    .type("DEBIT")
                    .amount(o.getTotalAmount())
                    .reference(o.getOrderNumber())
                    .build());
        }

        for (Payment p : periodPayments) {
            String desc = "Payment - " + p.getPaymentMode().name()
                    + (p.getPaymentMethodName() != null ? " (" + p.getPaymentMethodName() + ")" : "");
            entries.add(ReportDtos.LedgerEntry.builder()
                    .date(p.getCollectionDate())
                    .description(desc)
                    .type("CREDIT")
                    .amount(p.getAmount())
                    .reference(p.getReferenceNumber())
                    .build());
        }

        entries.sort(Comparator.comparing(ReportDtos.LedgerEntry::getDate)
                .thenComparing(e -> "DEBIT".equals(e.getType()) ? 0 : 1));

        BigDecimal running = openingBalance;
        for (ReportDtos.LedgerEntry entry : entries) {
            if ("DEBIT".equals(entry.getType())) {
                running = running.add(entry.getAmount());
            } else {
                running = running.subtract(entry.getAmount());
            }
            entry.setRunningBalance(running);
        }

        BigDecimal totalDebit  = periodOrders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCredit = periodPayments.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.CustomerLedgerResponse.builder()
                .customerId(customer.getId())
                .businessName(customer.getBusinessName())
                .phone(customer.getPhone())
                .from(from).to(to)
                .openingBalance(openingBalance)
                .closingBalance(running)
                .totalDebit(totalDebit)
                .totalCredit(totalCredit)
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
                            .map(PurchaseEntry::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                    LocalDate lastDate = e.getValue().stream()
                            .map(PurchaseEntry::getPurchaseDate)
                            .max(Comparator.naturalOrder())
                            .orElse(null);
                    return ReportDtos.VendorLedgerRow.builder()
                            .supplierName(e.getKey())
                            .entryCount(e.getValue().size())
                            .totalAmount(total)
                            .lastPurchaseDate(lastDate)
                            .build();
                })
                .sorted(Comparator.comparing(ReportDtos.VendorLedgerRow::getTotalAmount).reversed())
                .collect(Collectors.toList());

        BigDecimal grandTotal = rows.stream()
                .map(ReportDtos.VendorLedgerRow::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.VendorLedgerResponse.builder()
                .from(from).to(to)
                .vendors(rows)
                .totalPurchases(grandTotal)
                .build();
    }

    // ─── 4. Profit Report ─────────────────────────────────────────────────────

    public ReportDtos.ProfitReportResponse getProfitReport(UUID tenantId, LocalDate from, LocalDate to) {
        List<Order> orders = orderRepository.findByTenantDateRangeAndStatus(tenantId, from, to, Order.OrderStatus.DELIVERED);

        Set<String> batchNumbers = orders.stream()
                .flatMap(o -> o.getItems().stream())
                .map(OrderItem::getBatchNumber)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, StockBatch> batchMap = batchNumbers.isEmpty()
                ? Collections.emptyMap()
                : stockBatchRepository.findByTenantAndBatchNumbers(tenantId, batchNumbers)
                        .stream()
                        .collect(Collectors.toMap(StockBatch::getBatchNumber, b -> b));

        Map<String, List<Order>> byRoute = orders.stream()
                .collect(Collectors.groupingBy(o -> {
                    if (o.getCustomer() == null || o.getCustomer().getRoute() == null) return "__WALK_IN__";
                    return o.getCustomer().getRoute().getId().toString();
                }));

        List<ReportDtos.ProfitRouteRow> routeBreakdown = new ArrayList<>();

        for (Map.Entry<String, List<Order>> entry : byRoute.entrySet()) {
            String key = entry.getKey();
            List<Order> routeOrders = entry.getValue();
            Order sample = routeOrders.get(0);

            UUID routeId = "__WALK_IN__".equals(key) ? null : UUID.fromString(key);
            String routeName = "__WALK_IN__".equals(key)
                    ? "Walk-in / Counter"
                    : sample.getCustomer().getRoute().getName();

            BigDecimal revenue = routeOrders.stream()
                    .map(Order::getSubTotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal cogs = routeOrders.stream()
                    .flatMap(o -> o.getItems().stream())
                    .map(item -> computeItemCogs(item, batchMap))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal grossProfit = revenue.subtract(cogs);
            BigDecimal marginPercent = revenue.compareTo(BigDecimal.ZERO) > 0
                    ? grossProfit.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            routeBreakdown.add(ReportDtos.ProfitRouteRow.builder()
                    .routeId(routeId)
                    .routeName(routeName)
                    .orderCount(routeOrders.size())
                    .revenue(revenue)
                    .cogs(cogs)
                    .grossProfit(grossProfit)
                    .marginPercent(marginPercent)
                    .build());
        }

        routeBreakdown.sort(Comparator.comparing(ReportDtos.ProfitRouteRow::getGrossProfit).reversed());

        BigDecimal totalRevenue = routeBreakdown.stream().map(ReportDtos.ProfitRouteRow::getRevenue).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCogs    = routeBreakdown.stream().map(ReportDtos.ProfitRouteRow::getCogs).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalGrossProfit = totalRevenue.subtract(totalCogs);
        BigDecimal totalMarginPercent = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? totalGrossProfit.multiply(BigDecimal.valueOf(100)).divide(totalRevenue, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return ReportDtos.ProfitReportResponse.builder()
                .from(from).to(to)
                .totalOrders(orders.size())
                .totalRevenue(totalRevenue)
                .totalCogs(totalCogs)
                .totalGrossProfit(totalGrossProfit)
                .totalMarginPercent(totalMarginPercent)
                .routeBreakdown(routeBreakdown)
                .build();
    }

    private BigDecimal computeItemCogs(OrderItem item, Map<String, StockBatch> batchMap) {
        if (item.getBatchNumber() == null) return BigDecimal.ZERO;
        StockBatch batch = batchMap.get(item.getBatchNumber());
        if (batch == null) return BigDecimal.ZERO;
        BigDecimal purchaseGstPct = batch.getProduct().getPurchaseGstPercent();
        BigDecimal divisor = BigDecimal.valueOf(100).add(purchaseGstPct);
        BigDecimal costExclGst = batch.getPurchaseRate()
                .multiply(BigDecimal.valueOf(100))
                .divide(divisor, 4, RoundingMode.HALF_UP);
        return costExclGst
                .multiply(BigDecimal.valueOf(item.getQuantity()))
                .setScale(2, RoundingMode.HALF_UP);
    }
}
