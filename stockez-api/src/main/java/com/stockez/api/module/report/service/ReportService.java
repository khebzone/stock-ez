package com.stockez.api.module.report.service;

import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.customer.repository.CustomerRepository;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.OrderItem;
import com.stockez.api.module.order.entity.Payment;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.entity.PurchaseEntry;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.entity.SupplierPayment;
import com.stockez.api.module.purchase.repository.PurchaseEntryRepository;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.purchase.repository.SupplierPaymentRepository;
import com.stockez.api.module.role.entity.Permission;
import com.stockez.api.module.route.entity.Route;
import com.stockez.api.module.stockshortage.entity.StockShortage;
import com.stockez.api.module.stockshortage.repository.StockShortageRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import org.springframework.data.domain.Pageable;
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
    private final SupplierPaymentRepository supplierPaymentRepository;
    private final StockBatchRepository stockBatchRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final StockShortageRepository stockShortageRepository;
    private final com.stockez.api.module.route.repository.RouteRepository routeRepository;
    private final com.stockez.api.module.goodsreturn.repository.GoodsReturnRepository goodsReturnRepository;
    private final TenantRepository tenantRepository;

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
            BigDecimal cash   = sumByMode(day, Payment.PaymentMode.CASH);
            BigDecimal upi    = sumByMode(day, Payment.PaymentMode.UPI);
            BigDecimal credit = sumByMode(day, Payment.PaymentMode.CREDIT);
            BigDecimal bank   = day.stream()
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
                    .creditAmount(credit)
                    .totalAmount(total)
                    .build());
        }

        BigDecimal totalCollected = payments.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCash    = sumByMode(payments, Payment.PaymentMode.CASH);
        BigDecimal totalCredit  = sumByMode(payments, Payment.PaymentMode.CREDIT);
        BigDecimal totalDigital = totalCollected.subtract(totalCash).subtract(totalCredit);
        BigDecimal totalUncleared = payments.stream()
                .filter(p -> !p.isCleared())
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.CollectionReportResponse.builder()
                .dailyBreakdown(breakdown)
                .totalCollected(totalCollected)
                .totalCash(totalCash)
                .totalDigital(totalDigital)
                .totalCredit(totalCredit)
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

    public ReportDtos.AgingReportResponse getAgingReport(UUID tenantId, LocalDate asOfDate) {
        LocalDate today = asOfDate;

        List<Customer> customers = customerRepository.findByTenantIdAndActiveTrueOrderByBusinessNameAsc(tenantId);

        List<ReportDtos.AgingRow> rows = new ArrayList<>();

        for (Customer customer : customers) {
            List<Order> unpaidOrders = orderRepository.findUnpaidOrdersByCustomer(tenantId, customer.getId(), Order.OrderStatus.CANCELLED);
            if (unpaidOrders.isEmpty()) continue;

            BigDecimal b0to7   = BigDecimal.ZERO;
            BigDecimal b8to15  = BigDecimal.ZERO;
            BigDecimal b16to30 = BigDecimal.ZERO;
            BigDecimal b31to45 = BigDecimal.ZERO;
            BigDecimal b46to60 = BigDecimal.ZERO;
            BigDecimal b60plus = BigDecimal.ZERO;

            for (Order order : unpaidOrders) {
                long daysOld = ChronoUnit.DAYS.between(order.getOrderDate(), today);
                BigDecimal balance = order.getBalanceAmount();
                if (daysOld <= 7)        b0to7   = b0to7.add(balance);
                else if (daysOld <= 15)  b8to15  = b8to15.add(balance);
                else if (daysOld <= 30)  b16to30 = b16to30.add(balance);
                else if (daysOld <= 45)  b31to45 = b31to45.add(balance);
                else if (daysOld <= 60)  b46to60 = b46to60.add(balance);
                else                     b60plus = b60plus.add(balance);
            }

            rows.add(ReportDtos.AgingRow.builder()
                    .customerId(customer.getId())
                    .businessName(customer.getBusinessName())
                    .phone(customer.getPhone())
                    .totalOutstanding(b0to7.add(b8to15).add(b16to30).add(b31to45).add(b46to60).add(b60plus))
                    .bucket0to7(b0to7)
                    .bucket8to15(b8to15)
                    .bucket16to30(b16to30)
                    .bucket31to45(b31to45)
                    .bucket46to60(b46to60)
                    .bucket60plus(b60plus)
                    .build());
        }

        rows.sort(Comparator.comparing(ReportDtos.AgingRow::getTotalOutstanding).reversed());

        BigDecimal sumTotal  = rows.stream().map(ReportDtos.AgingRow::getTotalOutstanding).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum0to7   = rows.stream().map(ReportDtos.AgingRow::getBucket0to7).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum8to15  = rows.stream().map(ReportDtos.AgingRow::getBucket8to15).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum16to30 = rows.stream().map(ReportDtos.AgingRow::getBucket16to30).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum31to45 = rows.stream().map(ReportDtos.AgingRow::getBucket31to45).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum46to60 = rows.stream().map(ReportDtos.AgingRow::getBucket46to60).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sum60plus = rows.stream().map(ReportDtos.AgingRow::getBucket60plus).reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.AgingReportResponse.builder()
                .rows(rows)
                .summary(ReportDtos.AgingSummary.builder()
                        .totalOutstanding(sumTotal)
                        .bucket0to7(sum0to7)
                        .bucket8to15(sum8to15)
                        .bucket16to30(sum16to30)
                        .bucket31to45(sum31to45)
                        .bucket46to60(sum46to60)
                        .bucket60plus(sum60plus)
                        .customerCount(rows.size())
                        .build())
                .build();
    }

    // ─── 2. Daily Report ─────────────────────────────────────────────────────

    public ReportDtos.DailyReportResponse getDailyReport(UUID tenantId, LocalDate date) {
        List<Order> orders = orderRepository.findDailyOrders(tenantId, date, Order.OrderStatus.CANCELLED);
        List<Payment> payments = paymentRepository.findDailyPayments(tenantId, date);

        BigDecimal totalInvoiced    = orders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        // Refunds are negative payments — keep them out of "collected" so the total never reads
        // negative, and report them separately as money paid back out.
        BigDecimal totalCollected   = payments.stream().filter(p -> p.getPaymentMode() != Payment.PaymentMode.CREDIT)
                .map(Payment::getAmount).filter(a -> a.signum() >= 0).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalRefunds     = payments.stream().filter(p -> p.getPaymentMode() != Payment.PaymentMode.CREDIT)
                .map(Payment::getAmount).filter(a -> a.signum() < 0).map(BigDecimal::negate).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalOutstanding = orders.stream().map(Order::getBalanceAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        // Money each person actually collected ON THIS DATE (non-credit, non-refund) — the single
        // source of truth for every "Collected" figure on this page, so the Salesperson/Delivery
        // summaries can never again disagree with the top KPI and the Collections panel below.
        Map<UUID, BigDecimal> collectedByPerson = payments.stream()
                .filter(p -> p.getPaymentMode() != Payment.PaymentMode.CREDIT && p.getAmount().signum() >= 0)
                .collect(Collectors.groupingBy(p -> p.getCollectedBy().getId(),
                        Collectors.reducing(BigDecimal.ZERO, Payment::getAmount, BigDecimal::add)));

        Map<String, List<Order>> bySalesPersonAndRoute = orders.stream()
                .collect(Collectors.groupingBy(o -> o.getSalesPerson().getId() + "|" + resolveRouteId(o)));

        List<ReportDtos.DailySalesGroup> salesGroups = bySalesPersonAndRoute.values().stream()
                .map(personOrders -> {
                    com.stockez.api.module.user.entity.User sp = personOrders.get(0).getSalesPerson();
                    Route route = resolveRoute(personOrders.get(0));
                    BigDecimal invoiced  = personOrders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                    // What this person personally collected ON THIS DATE — not the orders' running
                    // paid-to-date total, which can include money collected on other days entirely.
                    BigDecimal collected = collectedByPerson.getOrDefault(sp.getId(), BigDecimal.ZERO);
                    BigDecimal balance   = personOrders.stream().map(Order::getBalanceAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

                    List<ReportDtos.DailyOrderRow> rows = personOrders.stream()
                            .sorted(Comparator.comparing(Order::getOrderNumber))
                            .map(o -> ReportDtos.DailyOrderRow.builder()
                                    .orderId(o.getId())
                                    .orderNumber(o.getOrderNumber())
                                    .customerName(o.getCustomer().getBusinessName())
                                    .status(o.getStatus().name())
                                    .totalAmount(o.getTotalAmount())
                                    .paidAmount(o.getPaidAmount())
                                    .balanceAmount(o.getBalanceAmount())
                                    .build())
                            .collect(Collectors.toList());

                    return ReportDtos.DailySalesGroup.builder()
                            .salespersonId(sp.getId())
                            .salespersonName(sp.getFullName())
                            .routeId(route != null ? route.getId() : null)
                            .routeName(route != null ? route.getName() : "No Route")
                            .orderCount(personOrders.size())
                            .totalInvoiced(invoiced)
                            .totalCollected(collected)
                            .balance(balance)
                            .orders(rows)
                            .build();
                })
                .sorted(Comparator.comparing(ReportDtos.DailySalesGroup::getTotalInvoiced).reversed())
                .collect(Collectors.toList());

        // Collections = real money coming in (positive, non-credit). Refunds (negative) are
        // pulled out into their own list so they never masquerade as a "collector" who
        // collected nothing.
        Map<UUID, List<Payment>> byCollector = payments.stream()
                .filter(p -> p.getPaymentMode() != Payment.PaymentMode.CREDIT && p.getAmount().signum() >= 0)
                .collect(Collectors.groupingBy(p -> p.getCollectedBy().getId()));

        List<ReportDtos.DailyCollectionGroup> collectionGroups = byCollector.values().stream()
                .map(personPayments -> {
                    com.stockez.api.module.user.entity.User collector = personPayments.get(0).getCollectedBy();
                    BigDecimal cash    = personPayments.stream().filter(p -> p.getPaymentMode() == Payment.PaymentMode.CASH).map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                    BigDecimal digital = personPayments.stream().filter(p -> p.getPaymentMode() != Payment.PaymentMode.CASH).map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

                    List<ReportDtos.DailyPaymentRow> rows = personPayments.stream()
                            .filter(p -> p.getOrder() != null)
                            .map(p -> ReportDtos.DailyPaymentRow.builder()
                                    .orderNumber(p.getOrder().getOrderNumber())
                                    .customerName(p.getOrder().getCustomer().getBusinessName())
                                    .paymentMode(p.getPaymentMode().name())
                                    .paymentMethodName(p.getPaymentMethodName())
                                    .amount(p.getAmount())
                                    .build())
                            .collect(Collectors.toList());

                    return ReportDtos.DailyCollectionGroup.builder()
                            .collectorId(collector.getId())
                            .collectorName(collector.getFullName())
                            .cashTotal(cash)
                            .digitalTotal(digital)
                            .total(cash.add(digital))
                            .payments(rows)
                            .build();
                })
                .sorted(Comparator.comparing(ReportDtos.DailyCollectionGroup::getTotal).reversed())
                .collect(Collectors.toList());

        List<ReportDtos.DailyRefundRow> refundRows = payments.stream()
                .filter(p -> p.getPaymentMode() != Payment.PaymentMode.CREDIT && p.getAmount().signum() < 0)
                .map(p -> ReportDtos.DailyRefundRow.builder()
                        .orderNumber(p.getOrder() != null ? p.getOrder().getOrderNumber() : null)
                        .customerName(p.getCustomer() != null ? p.getCustomer().getBusinessName()
                                : (p.getOrder() != null ? p.getOrder().getCustomer().getBusinessName() : null))
                        .processedByName(p.getCollectedBy() != null ? p.getCollectedBy().getFullName() : null)
                        .paymentMode(p.getPaymentMode().name())
                        .amount(p.getAmount().negate())
                        .build())
                .collect(Collectors.toList());

        List<Order> deliveryOrders = orderRepository.findDailyDeliveryOrders(tenantId, date,
                List.of(Order.OrderStatus.DISPATCHED, Order.OrderStatus.DELIVERED));

        Map<String, List<Order>> byDeliveryPersonAndRoute = deliveryOrders.stream()
                .collect(Collectors.groupingBy(o -> resolveDeliveryPerson(o).getId() + "|" + resolveRouteId(o)));

        List<ReportDtos.DailyDeliveryGroup> deliveryGroups = byDeliveryPersonAndRoute.values().stream()
                .map(personOrders -> {
                    com.stockez.api.module.user.entity.User dp = resolveDeliveryPerson(personOrders.get(0));
                    Route route = resolveRoute(personOrders.get(0));
                    BigDecimal total = personOrders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                    int deliveredCount  = (int) personOrders.stream().filter(o -> o.getStatus() == Order.OrderStatus.DELIVERED).count();
                    int dispatchedCount = (int) personOrders.stream().filter(o -> o.getStatus() == Order.OrderStatus.DISPATCHED).count();

                    List<ReportDtos.DailyDeliveryRow> rows = personOrders.stream()
                            .sorted(Comparator.comparing(Order::getOrderNumber))
                            .map(o -> ReportDtos.DailyDeliveryRow.builder()
                                    .orderId(o.getId())
                                    .orderNumber(o.getOrderNumber())
                                    .customerName(o.getCustomer().getBusinessName())
                                    .status(o.getStatus().name())
                                    .totalAmount(o.getTotalAmount())
                                    .paidAmount(o.getPaidAmount())
                                    .balanceAmount(o.getBalanceAmount())
                                    .build())
                            .collect(Collectors.toList());

                    return ReportDtos.DailyDeliveryGroup.builder()
                            .deliveryPersonId(dp.getId())
                            .deliveryPersonName(dp.getFullName())
                            .routeId(route != null ? route.getId() : null)
                            .routeName(route != null ? route.getName() : "No Route")
                            .orderCount(personOrders.size())
                            .deliveredCount(deliveredCount)
                            .dispatchedCount(dispatchedCount)
                            .totalAmount(total)
                            .totalCollected(collectedByPerson.getOrDefault(dp.getId(), BigDecimal.ZERO))
                            .orders(rows)
                            .build();
                })
                .sorted(Comparator.comparing(ReportDtos.DailyDeliveryGroup::getTotalAmount).reversed())
                .collect(Collectors.toList());

        return ReportDtos.DailyReportResponse.builder()
                .date(date)
                .summary(ReportDtos.DailySummary.builder()
                        .totalOrders(orders.size())
                        .totalInvoiced(totalInvoiced)
                        .totalCollected(totalCollected)
                        .totalRefunds(totalRefunds)
                        .totalOutstanding(totalOutstanding)
                        .build())
                .sales(salesGroups)
                .collections(collectionGroups)
                .refunds(refundRows)
                .deliveries(deliveryGroups)
                .build();
    }

    /**
     * The delivery person who actually handled an order — falls back to the route allocation's
     * delivery person, since the real dispatch flow stamps it there, not onto the order itself
     * (Order.deliveryPerson only gets set via the separate, rarely-used assignDelivery action).
     */
    private com.stockez.api.module.user.entity.User resolveDeliveryPerson(Order o) {
        if (o.getDeliveryPerson() != null) return o.getDeliveryPerson();
        if (o.getRouteAllocation() != null) return o.getRouteAllocation().getDeliveryPerson();
        return null;
    }

    /** The route an order was actually worked under — falls back to the customer's home route. */
    private Route resolveRoute(Order o) {
        if (o.getRouteAllocation() != null && o.getRouteAllocation().getRoute() != null) {
            return o.getRouteAllocation().getRoute();
        }
        if (o.getCustomer() != null && o.getCustomer().getRoute() != null) {
            return o.getCustomer().getRoute();
        }
        return null;
    }

    private String resolveRouteId(Order o) {
        Route route = resolveRoute(o);
        return route != null ? route.getId().toString() : "NONE";
    }

    // ─── 3. Sales Analysis ────────────────────────────────────────────────────

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
        BigDecimal openingCredits = paymentsBeforeFrom.stream()
                .filter(p -> p.getPaymentMode() != Payment.PaymentMode.CREDIT)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal openingBalance = openingDebits.subtract(openingCredits);

        List<Order> periodOrders   = orderRepository.findByTenantAndCustomerAndDateRange(tenantId, customerId, from, to, Order.OrderStatus.CANCELLED);
        List<Payment> periodPayments = paymentRepository.findByTenantAndCustomerAndDateRange(tenantId, customerId, from, to);

        List<ReportDtos.LedgerEntry> entries = new ArrayList<>();

        for (Order o : periodOrders) {
            String desc = o.isOpeningBalance() ? "Opening Balance" : "Order #" + o.getOrderNumber();
            entries.add(ReportDtos.LedgerEntry.builder()
                    .date(o.getOrderDate())
                    .description(desc)
                    .type("DEBIT")
                    .amount(o.getTotalAmount())
                    .reference(o.isOpeningBalance() ? null : o.getOrderNumber())
                    .build());
        }

        for (Payment p : periodPayments) {
            if (p.getPaymentMode() == Payment.PaymentMode.CREDIT) continue;
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
        BigDecimal totalCredit = periodPayments.stream()
                .filter(p -> p.getPaymentMode() != Payment.PaymentMode.CREDIT)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

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

    // ─── 3a-ii. Customer History (bill-wise collection statement) ─────────────

    public ReportDtos.CustomerHistoryResponse getCustomerHistory(
            UUID tenantId, UUID customerId, LocalDate from, LocalDate to) {

        Customer customer = customerRepository.findByIdAndTenantId(customerId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId.toString()));

        List<Order> ordersBeforeFrom = orderRepository.findByTenantAndCustomerBeforeDate(tenantId, customerId, from, Order.OrderStatus.CANCELLED);
        List<Payment> paymentsBeforeFrom = paymentRepository.findByTenantAndCustomerBeforeDate(tenantId, customerId, from);

        BigDecimal openingDebits  = ordersBeforeFrom.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal openingCredits = paymentsBeforeFrom.stream()
                .filter(p -> p.getPaymentMode() != Payment.PaymentMode.CREDIT)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal openingBalance = openingDebits.subtract(openingCredits);

        List<Order> periodOrders     = orderRepository.findByTenantAndCustomerAndDateRange(tenantId, customerId, from, to, Order.OrderStatus.CANCELLED);
        List<Payment> periodPayments = paymentRepository.findByTenantAndCustomerAndDateRange(tenantId, customerId, from, to);

        Comparator<Order> billOrder = Comparator
                .comparing(Order::getOrderDate, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(Order::getOrderNumber, Comparator.nullsLast(Comparator.naturalOrder()));

        Map<UUID, Order> billById = new LinkedHashMap<>();
        periodOrders.stream().sorted(billOrder).forEach(o -> billById.put(o.getId(), o));

        Map<UUID, List<Payment>> collectionsByBill = new LinkedHashMap<>();
        for (Payment p : periodPayments) {
            if (p.getPaymentMode() == Payment.PaymentMode.CREDIT) continue;
            Order o = p.getOrder();
            if (o == null) continue;
            billById.putIfAbsent(o.getId(), o); // in-range payment against a pre-range bill
            collectionsByBill.computeIfAbsent(o.getId(), k -> new ArrayList<>()).add(p);
        }

        List<ReportDtos.CustomerHistoryRow> rows = new ArrayList<>();
        int serial = 1;
        for (Order o : billById.values().stream().sorted(billOrder).collect(Collectors.toList())) {
            String billNo = o.isOpeningBalance() ? "Opening Balance" : o.getOrderNumber();
            List<Payment> cols = collectionsByBill.getOrDefault(o.getId(), List.of()).stream()
                    .sorted(Comparator.comparing(Payment::getCollectionDate, Comparator.nullsFirst(Comparator.naturalOrder()))
                            .thenComparing(Payment::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                    .collect(Collectors.toList());

            BigDecimal due = o.getTotalAmount();
            if (cols.isEmpty()) {
                rows.add(ReportDtos.CustomerHistoryRow.builder()
                        .serialNo(serial++)
                        .billNo(billNo).billDate(o.getOrderDate()).billAmount(o.getTotalAmount())
                        .dueAmount(due)
                        .build());
            } else {
                boolean first = true;
                for (Payment p : cols) {
                    due = due.subtract(p.getAmount());
                    rows.add(ReportDtos.CustomerHistoryRow.builder()
                            .serialNo(serial++)
                            .billNo(first ? billNo : null)
                            .billDate(first ? o.getOrderDate() : null)
                            .billAmount(first ? o.getTotalAmount() : null)
                            .collectionDate(p.getCollectionDate())
                            .collectionAmount(p.getAmount())
                            .collectedBy(p.getCollectedBy() != null ? p.getCollectedBy().getFullName() : null)
                            .paymentMode(modeLabel(p))
                            .dueAmount(due)
                            .build());
                    first = false;
                }
            }
        }

        BigDecimal totalBilled = periodOrders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCollected = periodPayments.stream()
                .filter(p -> p.getPaymentMode() != Payment.PaymentMode.CREDIT)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.CustomerHistoryResponse.builder()
                .customerId(customer.getId())
                .businessName(customer.getBusinessName())
                .phone(customer.getPhone())
                .from(from).to(to)
                .openingBalance(openingBalance)
                .totalBilled(totalBilled)
                .totalCollected(totalCollected)
                .closingBalance(openingBalance.add(totalBilled).subtract(totalCollected))
                .rows(rows)
                .build();
    }

    private String modeLabel(Payment p) {
        String raw = (p.getPaymentMethodName() != null && !p.getPaymentMethodName().isBlank())
                ? p.getPaymentMethodName() : p.getPaymentMode().name();
        return raw.isEmpty() ? raw : Character.toUpperCase(raw.charAt(0)) + raw.substring(1).toLowerCase();
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

    // ─── 3c. Supplier History (bill-wise purchase & payment statement) ────────

    public ReportDtos.SupplierHistoryResponse getSupplierHistory(
            UUID tenantId, String supplierName, LocalDate from, LocalDate to) {

        BigDecimal openingPurchased = purchaseEntryRepository.sumPurchasedBySupplierBeforeDate(tenantId, supplierName, from);
        BigDecimal openingPaid      = supplierPaymentRepository.sumPaidBySupplierBeforeDate(tenantId, supplierName, from);
        BigDecimal openingCredit    = goodsReturnRepository.sumOpenSupplierCreditBeforeDate(tenantId, supplierName, from);
        BigDecimal openingBalance   = openingPurchased.subtract(openingPaid).subtract(openingCredit);

        List<PurchaseEntry> periodEntries    = purchaseEntryRepository.findByTenantAndSupplierAndDateRange(tenantId, supplierName, from, to);
        List<SupplierPayment> periodPayments = supplierPaymentRepository.findByTenantAndSupplierAndDateRange(tenantId, supplierName, from, to);

        Comparator<PurchaseEntry> billOrder = Comparator
                .comparing(PurchaseEntry::getPurchaseDate, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(PurchaseEntry::getEntryNumber, Comparator.nullsLast(Comparator.naturalOrder()));

        Map<UUID, PurchaseEntry> billById = new LinkedHashMap<>();
        periodEntries.stream().sorted(billOrder).forEach(e -> billById.put(e.getId(), e));

        Map<UUID, List<SupplierPayment>> paymentsByBill = new LinkedHashMap<>();
        List<SupplierPayment> onAccount = new ArrayList<>();
        for (SupplierPayment p : periodPayments) {
            PurchaseEntry e = p.getPurchaseEntry();
            if (e == null) { onAccount.add(p); continue; }
            billById.putIfAbsent(e.getId(), e); // in-range payment against a pre-range bill
            paymentsByBill.computeIfAbsent(e.getId(), k -> new ArrayList<>()).add(p);
        }

        List<ReportDtos.SupplierHistoryRow> rows = new ArrayList<>();
        int serial = 1;
        for (PurchaseEntry e : billById.values().stream().sorted(billOrder).collect(Collectors.toList())) {
            String billNo = e.isOpeningBalance() ? "Opening Balance" : e.getEntryNumber();
            String invoiceNo = e.isOpeningBalance() ? null : e.getInvoiceNumber();
            List<SupplierPayment> pays = paymentsByBill.getOrDefault(e.getId(), List.of()).stream()
                    .sorted(Comparator.comparing(SupplierPayment::getPaymentDate, Comparator.nullsFirst(Comparator.naturalOrder()))
                            .thenComparing(SupplierPayment::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                    .collect(Collectors.toList());

            BigDecimal due = e.getTotalAmount();
            if (pays.isEmpty()) {
                rows.add(ReportDtos.SupplierHistoryRow.builder()
                        .serialNo(serial++)
                        .billNo(billNo).invoiceNo(invoiceNo)
                        .billDate(e.getPurchaseDate()).billAmount(e.getTotalAmount())
                        .dueAmount(due)
                        .build());
            } else {
                boolean first = true;
                for (SupplierPayment p : pays) {
                    due = due.subtract(p.getAmount());
                    rows.add(ReportDtos.SupplierHistoryRow.builder()
                            .serialNo(serial++)
                            .billNo(first ? billNo : null)
                            .invoiceNo(first ? invoiceNo : null)
                            .billDate(first ? e.getPurchaseDate() : null)
                            .billAmount(first ? e.getTotalAmount() : null)
                            .paymentDate(p.getPaymentDate())
                            .paymentAmount(p.getAmount())
                            .paymentMethod(p.getPaymentMethod())
                            .dueAmount(due)
                            .build());
                    first = false;
                }
            }
        }

        boolean firstOnAccount = true;
        for (SupplierPayment p : onAccount.stream()
                .sorted(Comparator.comparing(SupplierPayment::getPaymentDate, Comparator.nullsFirst(Comparator.naturalOrder())))
                .collect(Collectors.toList())) {
            rows.add(ReportDtos.SupplierHistoryRow.builder()
                    .serialNo(serial++)
                    .billNo(firstOnAccount ? "On-Account Payments" : null)
                    .paymentDate(p.getPaymentDate())
                    .paymentAmount(p.getAmount())
                    .paymentMethod(p.getPaymentMethod())
                    .build());
            firstOnAccount = false;
        }

        // Goods sent back to this supplier — debit notes. An open one (or one knocked off a bill)
        // still reduces the closing balance; one paid back in cash or replaced with goods does not.
        List<com.stockez.api.module.goodsreturn.entity.GoodsReturn> periodReturns =
                goodsReturnRepository.findSupplierClaimsInPeriod(tenantId, supplierName, from, to);

        BigDecimal totalReturned = BigDecimal.ZERO;
        BigDecimal returnCreditOpen = BigDecimal.ZERO;
        boolean firstReturn = true;
        for (com.stockez.api.module.goodsreturn.entity.GoodsReturn gr : periodReturns) {
            boolean reduces = gr.getSettlementMode() == com.stockez.api.module.goodsreturn.entity.GoodsReturn.SettlementMode.ADJUST_AGAINST_BILL
                    || (gr.getType() == com.stockez.api.module.goodsreturn.entity.GoodsReturn.ReturnType.PURCHASE_RETURN
                        && gr.getSettlementMode() == null);
            totalReturned = totalReturned.add(gr.getTotalAmount());
            if (reduces) returnCreditOpen = returnCreditOpen.add(gr.getTotalAmount());

            rows.add(ReportDtos.SupplierHistoryRow.builder()
                    .serialNo(serial++)
                    .billNo(firstReturn ? "Goods Returned" : null)
                    .invoiceNo(gr.getReferencePurchaseEntry() != null
                            ? gr.getReferencePurchaseEntry().getInvoiceNumber() : null)
                    .returnNo(gr.getReturnNumber())
                    .returnDate(gr.getReturnDate())
                    .returnAmount(gr.getTotalAmount())
                    .settlementMode(gr.getSettlementMode() != null ? gr.getSettlementMode().name() : null)
                    .reducesPayable(reduces)
                    .build());
            firstReturn = false;
        }

        BigDecimal totalPurchased = periodEntries.stream().map(PurchaseEntry::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPaid = periodPayments.stream().map(SupplierPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.SupplierHistoryResponse.builder()
                .supplierName(supplierName)
                .from(from).to(to)
                .openingBalance(openingBalance)
                .totalPurchased(totalPurchased)
                .totalPaid(totalPaid)
                .totalReturned(totalReturned)
                .returnCreditOpen(returnCreditOpen)
                .closingBalance(openingBalance.add(totalPurchased).subtract(totalPaid).subtract(returnCreditOpen))
                .rows(rows)
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

    // ─── 5. Brand Profit Report ───────────────────────────────────────────────

    public ReportDtos.BrandProfitResponse getBrandProfitReport(UUID tenantId, LocalDate from, LocalDate to) {
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

        List<OrderItem> allItems = orders.stream()
                .flatMap(o -> o.getItems().stream())
                .collect(Collectors.toList());

        Map<String, List<OrderItem>> byBrand = allItems.stream()
                .collect(Collectors.groupingBy(i -> {
                    String brand = i.getProduct().getBrand();
                    return brand != null ? brand : "Unbranded";
                }));

        List<ReportDtos.BrandProfitRow> brandRows = byBrand.entrySet().stream()
                .map(e -> {
                    List<OrderItem> items = e.getValue();
                    int qtySold = items.stream().mapToInt(OrderItem::getQuantity).sum();
                    long orderCount = items.stream().map(i -> i.getOrder().getId()).distinct().count();

                    BigDecimal revenue = items.stream()
                            .map(i -> i.getLineTotal().subtract(i.getGstAmount()))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    BigDecimal cogs = items.stream()
                            .map(i -> computeItemCogs(i, batchMap))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    BigDecimal grossProfit = revenue.subtract(cogs);
                    BigDecimal marginPercent = revenue.compareTo(BigDecimal.ZERO) > 0
                            ? grossProfit.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO;

                    return ReportDtos.BrandProfitRow.builder()
                            .brand(e.getKey())
                            .qtySold(qtySold)
                            .orderCount((int) orderCount)
                            .revenue(revenue)
                            .cogs(cogs)
                            .grossProfit(grossProfit)
                            .marginPercent(marginPercent)
                            .build();
                })
                .sorted(Comparator.comparing(ReportDtos.BrandProfitRow::getGrossProfit).reversed())
                .collect(Collectors.toList());

        BigDecimal totalRevenue     = brandRows.stream().map(ReportDtos.BrandProfitRow::getRevenue).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCogs        = brandRows.stream().map(ReportDtos.BrandProfitRow::getCogs).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalGrossProfit = totalRevenue.subtract(totalCogs);
        BigDecimal totalMargin      = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? totalGrossProfit.multiply(BigDecimal.valueOf(100)).divide(totalRevenue, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return ReportDtos.BrandProfitResponse.builder()
                .from(from).to(to)
                .totalOrders(orders.size())
                .totalRevenue(totalRevenue)
                .totalCogs(totalCogs)
                .totalGrossProfit(totalGrossProfit)
                .totalMarginPercent(totalMargin)
                .brands(brandRows)
                .build();
    }

    // ─── Closing Stock ───────────────────────────────────────────────────────

    public ReportDtos.ClosingStockResponse getClosingStock(UUID tenantId) {
        List<Product> products = productRepository.findByTenantIdAndActiveTrue(tenantId, Pageable.unpaged()).getContent();

        List<ReportDtos.ClosingStockRow> rows = products.stream()
                .sorted(Comparator.comparing(Product::getName))
                .map(p -> {
                    int qty = p.getStockQuantity() != null ? p.getStockQuantity() : 0;
                    BigDecimal gstFactor = BigDecimal.ONE.add(
                            p.getPurchaseGstPercent().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
                    BigDecimal rateExclGst = p.getPurchaseRate().divide(gstFactor, 2, RoundingMode.HALF_UP);
                    BigDecimal stockValue = rateExclGst.multiply(BigDecimal.valueOf(qty)).setScale(2, RoundingMode.HALF_UP);
                    return ReportDtos.ClosingStockRow.builder()
                            .productId(p.getId())
                            .productName(p.getName())
                            .brand(p.getBrand())
                            .category(p.getCategory())
                            .subCategory(p.getSubCategory())
                            .unit(p.getUnit())
                            .hsnCode(p.getHsnCode())
                            .stockQty(qty)
                            .purchaseRateExclGst(rateExclGst)
                            .stockValue(stockValue)
                            .build();
                })
                .collect(Collectors.toList());

        BigDecimal totalValue = rows.stream().map(ReportDtos.ClosingStockRow::getStockValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int outOfStock = (int) rows.stream().filter(r -> r.getStockQty() == 0).count();
        int lowStock   = (int) rows.stream().filter(r -> r.getStockQty() > 0 && r.getStockQty() <= 10).count();

        return ReportDtos.ClosingStockResponse.builder()
                .rows(rows)
                .totalProducts(rows.size())
                .outOfStockCount(outOfStock)
                .lowStockCount(lowStock)
                .totalStockValue(totalValue)
                .build();
    }

    // ─── Dead Stock ──────────────────────────────────────────────────────────

    public List<ReportDtos.DeadStockItem> getDeadStock(UUID tenantId, int days, String brand, String category) {
        LocalDate today = LocalDate.now();

        List<Object[]> lastBilledResults = orderRepository.findLastBilledDatePerProduct(tenantId, Order.OrderStatus.CANCELLED);
        Map<UUID, LocalDate> lastBilledMap = lastBilledResults.stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (LocalDate) row[1]
                ));

        Map<UUID, LocalDate> firstReceivedMap = stockBatchRepository.findFirstReceivedDatePerProduct(tenantId).stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (LocalDate) row[1]
                ));

        List<Product> products = productRepository.findByTenantIdAndActiveTrue(tenantId, Pageable.unpaged()).getContent();

        return products.stream()
                .filter(p -> p.getStockQuantity() != null && p.getStockQuantity() > 0)
                .filter(p -> brand == null || brand.isBlank() || brand.equals(p.getBrand()))
                .filter(p -> category == null || category.isBlank() || category.equals(p.getCategory()))
                .map(p -> {
                    LocalDate lastBilled = lastBilledMap.get(p.getId());
                    LocalDate firstReceived = firstReceivedMap.get(p.getId());
                    LocalDate idleFrom = lastBilled != null ? lastBilled : firstReceived;
                    int daysIdle = idleFrom != null
                            ? (int) ChronoUnit.DAYS.between(idleFrom, today)
                            : 9999;
                    return ReportDtos.DeadStockItem.builder()
                            .productId(p.getId())
                            .productName(p.getName())
                            .brand(p.getBrand())
                            .category(p.getCategory())
                            .unit(p.getUnit())
                            .stockQty(p.getStockQuantity() != null ? p.getStockQuantity() : 0)
                            .lastBilledDate(lastBilled)
                            .firstReceivedDate(firstReceived)
                            .daysIdle(daysIdle)
                            .build();
                })
                .filter(item -> item.getDaysIdle() >= days)
                .sorted(Comparator.comparingInt(ReportDtos.DeadStockItem::getDaysIdle).reversed())
                .collect(Collectors.toList());
    }

    // ─── Salesman Dead Stock ─────────────────────────────────────────────────

    public List<ReportDtos.SalesmanDeadStockItem> getSalesmanDeadStock(UUID tenantId, int days, UUID salesPersonId) {
        LocalDate today = LocalDate.now();

        List<User> salesUsers = userRepository.findByTenantIdAndPermissionAndActiveTrue(tenantId, Permission.ORDERS_CREATE);
        if (salesUsers.isEmpty()) return List.of();

        Map<UUID, String> salesPersonNames = salesUsers.stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));

        Set<UUID> targetIds = salesPersonId != null
                ? Set.of(salesPersonId)
                : salesPersonNames.keySet();

        Map<UUID, Map<UUID, LocalDate>> perPersonLastBilled = new HashMap<>();
        orderRepository.findLastBilledDatePerProductPerSalesperson(tenantId, Order.OrderStatus.CANCELLED)
                .forEach(row -> {
                    UUID prodId = (UUID) row[0];
                    UUID spId = (UUID) row[1];
                    LocalDate date = (LocalDate) row[2];
                    perPersonLastBilled.computeIfAbsent(spId, k -> new HashMap<>()).put(prodId, date);
                });

        Map<UUID, LocalDate> firstReceivedMap = stockBatchRepository.findFirstReceivedDatePerProduct(tenantId).stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (LocalDate) row[1]));

        List<Product> products = productRepository.findByTenantIdAndActiveTrue(tenantId, Pageable.unpaged()).getContent()
                .stream().filter(p -> p.getStockQuantity() != null && p.getStockQuantity() > 0)
                .collect(Collectors.toList());

        List<ReportDtos.SalesmanDeadStockItem> result = new ArrayList<>();

        for (UUID spId : targetIds) {
            String spName = salesPersonNames.get(spId);
            if (spName == null) continue;
            Map<UUID, LocalDate> productLastBilled = perPersonLastBilled.getOrDefault(spId, Map.of());

            for (Product p : products) {
                LocalDate lastBilled = productLastBilled.get(p.getId());
                LocalDate firstReceived = firstReceivedMap.get(p.getId());
                LocalDate idleFrom = lastBilled != null ? lastBilled : firstReceived;
                int daysIdle = idleFrom != null ? (int) ChronoUnit.DAYS.between(idleFrom, today) : 9999;

                if (daysIdle >= days) {
                    result.add(ReportDtos.SalesmanDeadStockItem.builder()
                            .salesPersonId(spId)
                            .salesPersonName(spName)
                            .productId(p.getId())
                            .productName(p.getName())
                            .brand(p.getBrand())
                            .category(p.getCategory())
                            .unit(p.getUnit())
                            .stockQty(p.getStockQuantity())
                            .lastBilledDate(lastBilled)
                            .firstReceivedDate(firstReceived)
                            .daysIdle(daysIdle)
                            .build());
                }
            }
        }

        result.sort(Comparator.comparing(ReportDtos.SalesmanDeadStockItem::getSalesPersonName)
                .thenComparing(Comparator.comparingInt(ReportDtos.SalesmanDeadStockItem::getDaysIdle).reversed()));
        return result;
    }

    // ─── Collection Detail ───────────────────────────────────────────────────

    public List<ReportDtos.CollectionDetailRow> getCollectionDetail(UUID tenantId, LocalDate from, LocalDate to) {
        List<com.stockez.api.module.order.entity.Payment> payments =
                paymentRepository.findDetailByTenantAndDateRange(tenantId, from, to);
        List<ReportDtos.CollectionDetailRow> rows = new ArrayList<>();
        int seq = 1;
        for (com.stockez.api.module.order.entity.Payment p : payments) {
            rows.add(ReportDtos.CollectionDetailRow.builder()
                    .sNo(seq++)
                    .collectionDate(p.getCollectionDate())
                    .customerName(p.getOrder().getCustomer().getBusinessName())
                    .orderNumber(p.getOrder().getOrderNumber())
                    .paymentMode(p.getPaymentMode().name())
                    .paymentMethodName(p.getPaymentMethodName())
                    .referenceNumber(p.getReferenceNumber())
                    .amount(p.getAmount())
                    .collectedBy(p.getCollectedBy().getFullName())
                    .cleared(p.isCleared())
                    .build());
        }
        return rows;
    }

    // ─── Purchase Register (GST Audit) ──────────────────────────────────────

    public List<ReportDtos.PurchaseRegisterRow> getPurchaseRegister(UUID tenantId, LocalDate from, LocalDate to) {
        List<com.stockez.api.module.purchase.entity.PurchaseEntry> entries =
                purchaseEntryRepository.findWithItemsByTenantAndDateRange(tenantId, from, to);
        List<ReportDtos.PurchaseRegisterRow> rows = new ArrayList<>();
        int seq = 1;
        for (com.stockez.api.module.purchase.entity.PurchaseEntry entry : entries) {
            String supplierGstin = entry.getSupplier() != null ? entry.getSupplier().getGstin() : null;
            for (com.stockez.api.module.purchase.entity.PurchaseItem item : entry.getItems()) {
                rows.add(ReportDtos.PurchaseRegisterRow.builder()
                        .sNo(seq++)
                        .purchaseNo(entry.getEntryNumber())
                        .supplierInvNo(entry.getInvoiceNumber())
                        .purchaseDate(entry.getPurchaseDate())
                        .supplierName(entry.getSupplierName())
                        .supplierGstin(supplierGstin)
                        .productName(item.getProduct().getName())
                        .unit(item.getProduct().getUnit())
                        .hsnCode(item.getProduct().getHsnCode())
                        .gstPercent(item.getGstPercent())
                        .gstAmount(item.getGstAmount())
                        .cgstPercent(item.getCgstPercent())
                        .cgstAmount(item.getCgstAmount())
                        .sgstPercent(item.getSgstPercent())
                        .sgstAmount(item.getSgstAmount())
                        .quantity(item.getQuantity())
                        .rateExclGst(item.getRateExclGst())
                        .netAmount(item.getAmount())
                        .build());
            }
        }
        return rows;
    }

    // ─── Sales Register (GST Audit) ──────────────────────────────────────────

    public List<ReportDtos.SalesRegisterRow> getSalesRegister(UUID tenantId, LocalDate from, LocalDate to) {
        List<OrderItem> items = orderRepository.findDeliveredItemsByTenantAndDateRange(
                tenantId, from, to, Order.OrderStatus.DELIVERED);
        List<ReportDtos.SalesRegisterRow> rows = new ArrayList<>();
        int seq = 1;
        for (OrderItem item : items) {
            BigDecimal halfPct = item.getGstPercent().divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            BigDecimal halfAmt = item.getGstAmount().divide(BigDecimal.valueOf(2), 3, RoundingMode.HALF_UP);
            rows.add(ReportDtos.SalesRegisterRow.builder()
                    .sNo(seq++)
                    .invNo(item.getOrder().getOrderNumber())
                    .invDate(item.getOrder().getOrderDate())
                    .customerName(item.getOrder().getCustomer().getBusinessName())
                    .gstin(item.getOrder().getCustomer().getGstin())
                    .productName(item.getProduct().getName())
                    .unit(item.getProduct().getUnit())
                    .hsnCode(item.getProduct().getHsnCode())
                    .gstPercent(item.getGstPercent())
                    .gstAmount(item.getGstAmount())
                    .cgstPercent(halfPct)
                    .cgstAmount(halfAmt)
                    .sgstPercent(halfPct)
                    .sgstAmount(halfAmt)
                    .quantity(item.getQuantity())
                    .unitPrice(item.getUnitPrice())
                    .netAmount(item.getLineTotal())
                    .build());
        }
        return rows;
    }

    private BigDecimal computeItemCogs(OrderItem item, Map<String, StockBatch> batchMap) {
        if (item.getBatchNumber() == null) return BigDecimal.ZERO;
        StockBatch batch = batchMap.get(item.getBatchNumber());
        if (batch == null) return BigDecimal.ZERO;
        BigDecimal purchaseGstPct = batch.getPurchaseGstPercent() != null
                ? batch.getPurchaseGstPercent()
                : batch.getProduct().getPurchaseGstPercent();
        BigDecimal divisor = BigDecimal.valueOf(100).add(purchaseGstPct);
        BigDecimal costExclGst = batch.getPurchaseRate()
                .multiply(BigDecimal.valueOf(100))
                .divide(divisor, 4, RoundingMode.HALF_UP);
        return costExclGst
                .multiply(BigDecimal.valueOf(item.getQuantity()))
                .setScale(2, RoundingMode.HALF_UP);
    }

    // ─── Shortage / Loss Report ───────────────────────────────────────────────

    public ReportDtos.ShortageReportResponse getShortageReport(UUID tenantId, LocalDate from, LocalDate to) {
        List<StockShortage> shortages = stockShortageRepository.findByTenantAndDateRange(tenantId, from, to);

        List<ReportDtos.ShortageRow> rows = shortages.stream()
                .map(s -> ReportDtos.ShortageRow.builder()
                        .shortageDate(s.getShortageDate())
                        .sourceType(s.getSourceType().name())
                        .referenceNumber(s.getReferenceNumber())
                        .productName(s.getProduct().getName())
                        .brand(s.getProduct().getBrand())
                        .batchNumber(s.getBatchNumber())
                        .quantityShort(s.getQuantityShort())
                        .unitRate(s.getUnitRate())
                        .lossValue(s.getLossValue())
                        .routeName(s.getRouteName() != null ? s.getRouteName() : "No Route")
                        .responsiblePersonName(s.getResponsiblePerson() != null ? s.getResponsiblePerson().getFullName() : "Unassigned")
                        .verifiedByName(s.getVerifiedBy().getFullName())
                        .build())
                .collect(Collectors.toList());

        List<ReportDtos.ShortageGroupRow> byRoute = groupShortages(shortages, s ->
                s.getRouteName() != null ? s.getRouteName() : "No Route");

        List<ReportDtos.ShortageGroupRow> byPerson = groupShortages(shortages, s ->
                s.getResponsiblePerson() != null ? s.getResponsiblePerson().getFullName() : "Unassigned");

        int totalQty = shortages.stream().mapToInt(StockShortage::getQuantityShort).sum();
        BigDecimal totalLoss = shortages.stream().map(StockShortage::getLossValue).reduce(BigDecimal.ZERO, BigDecimal::add);

        return ReportDtos.ShortageReportResponse.builder()
                .from(from).to(to)
                .totalOccurrences(shortages.size())
                .totalQuantityShort(totalQty)
                .totalLossValue(totalLoss)
                .rows(rows)
                .byRoute(byRoute)
                .byPerson(byPerson)
                .build();
    }

    private List<ReportDtos.ShortageGroupRow> groupShortages(
            List<StockShortage> shortages, java.util.function.Function<StockShortage, String> keyFn) {
        Map<String, List<StockShortage>> grouped = shortages.stream().collect(Collectors.groupingBy(keyFn));
        return grouped.entrySet().stream()
                .map(e -> ReportDtos.ShortageGroupRow.builder()
                        .name(e.getKey())
                        .occurrences(e.getValue().size())
                        .quantityShort(e.getValue().stream().mapToInt(StockShortage::getQuantityShort).sum())
                        .lossValue(e.getValue().stream().map(StockShortage::getLossValue).reduce(BigDecimal.ZERO, BigDecimal::add))
                        .build())
                .sorted(Comparator.comparing(ReportDtos.ShortageGroupRow::getLossValue).reversed())
                .collect(Collectors.toList());
    }

    // ─── Customer Sales (totals per customer) ────────────────────────────────

    public ReportDtos.CustomerSalesResponse getCustomerSales(UUID tenantId, LocalDate from, LocalDate to) {
        List<Order> orders = orderRepository.findByTenantAndDateRange(tenantId, from, to, Order.OrderStatus.CANCELLED);

        List<ReportDtos.CustomerSalesRow> rows = orders.stream()
                .filter(o -> o.getCustomer() != null)
                .collect(Collectors.groupingBy(o -> o.getCustomer().getId()))
                .values().stream()
                .map(co -> {
                    Customer c = co.get(0).getCustomer();
                    int qty = co.stream().flatMap(o -> o.getItems().stream()).mapToInt(OrderItem::getQuantity).sum();
                    BigDecimal amt = co.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                    BigDecimal bal = co.stream().map(Order::getBalanceAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                    return ReportDtos.CustomerSalesRow.builder()
                            .customerId(c.getId())
                            .customerName(c.getBusinessName())
                            .routeName(c.getRoute() != null ? c.getRoute().getName() : "—")
                            .orderCount(co.size()).totalQty(qty)
                            .totalAmount(amt).outstanding(bal)
                            .build();
                })
                .sorted(Comparator.comparing(ReportDtos.CustomerSalesRow::getTotalAmount).reversed())
                .collect(Collectors.toList());

        return ReportDtos.CustomerSalesResponse.builder()
                .from(from).to(to).rows(rows)
                .customerCount(rows.size())
                .totalOrders(orders.size())
                .totalQty(rows.stream().mapToInt(ReportDtos.CustomerSalesRow::getTotalQty).sum())
                .totalAmount(rows.stream().map(ReportDtos.CustomerSalesRow::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add))
                .totalOutstanding(rows.stream().map(ReportDtos.CustomerSalesRow::getOutstanding).reduce(BigDecimal.ZERO, BigDecimal::add))
                .build();
    }

    // ─── Customer Item Report (items a customer bought) ──────────────────────

    public ReportDtos.CustomerItemResponse getCustomerItemReport(UUID tenantId, UUID customerId, LocalDate from, LocalDate to) {
        Customer c = customerRepository.findByIdAndTenantId(customerId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId.toString()));
        List<OrderItem> items = orderRepository
                .findByTenantAndCustomerAndDateRange(tenantId, customerId, from, to, Order.OrderStatus.CANCELLED)
                .stream().flatMap(o -> o.getItems().stream()).collect(Collectors.toList());
        List<ReportDtos.ItemMovementRow> rows = aggregateItems(items);
        return ReportDtos.CustomerItemResponse.builder()
                .customerId(customerId).customerName(c.getBusinessName())
                .routeName(c.getRoute() != null ? c.getRoute().getName() : "—")
                .from(from).to(to).rows(rows)
                .totalQty(rows.stream().mapToInt(ReportDtos.ItemMovementRow::getQty).sum())
                .totalAmount(rows.stream().map(ReportDtos.ItemMovementRow::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add))
                .build();
    }

    // ─── Route Item Report (item movement on a route) ────────────────────────

    public ReportDtos.RouteItemResponse getRouteItemReport(UUID tenantId, UUID routeId, LocalDate from, LocalDate to) {
        List<Order> orders = orderRepository.findByTenantAndDateRange(tenantId, from, to, Order.OrderStatus.CANCELLED);
        List<OrderItem> items;
        String routeName;
        if (routeId != null) {
            items = orders.stream()
                    .filter(o -> { Route r = resolveRoute(o); return r != null && r.getId().equals(routeId); })
                    .flatMap(o -> o.getItems().stream()).collect(Collectors.toList());
            routeName = routeRepository.findByIdAndTenantId(routeId, tenantId).map(Route::getName).orElse("Route");
        } else {
            items = orders.stream().flatMap(o -> o.getItems().stream()).collect(Collectors.toList());
            routeName = "All Routes";
        }
        List<ReportDtos.ItemMovementRow> rows = aggregateItems(items);
        return ReportDtos.RouteItemResponse.builder()
                .routeId(routeId).routeName(routeName).from(from).to(to).rows(rows)
                .totalQty(rows.stream().mapToInt(ReportDtos.ItemMovementRow::getQty).sum())
                .totalAmount(rows.stream().map(ReportDtos.ItemMovementRow::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add))
                .build();
    }

    // ─── Item History (who bought a product, and how much — optionally one customer) ─

    public ReportDtos.ItemHistoryResponse getItemHistory(
            UUID tenantId, UUID productId, UUID customerId, LocalDate from, LocalDate to) {
        Product product = productRepository.findByIdAndTenantId(productId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId.toString()));

        String customerName = "All Customers";
        List<Order> orders;
        if (customerId != null) {
            Customer c = customerRepository.findByIdAndTenantId(customerId, tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId.toString()));
            customerName = c.getBusinessName();
            orders = orderRepository.findByTenantAndCustomerAndDateRange(tenantId, customerId, from, to, Order.OrderStatus.CANCELLED);
        } else {
            orders = orderRepository.findByTenantAndDateRange(tenantId, from, to, Order.OrderStatus.CANCELLED);
        }

        List<ReportDtos.ItemHistoryRow> rows = orders.stream()
                .flatMap(o -> o.getItems().stream()
                        .filter(i -> i.getProduct() != null && i.getProduct().getId().equals(productId))
                        .map(i -> ReportDtos.ItemHistoryRow.builder()
                                .orderId(o.getId())
                                .orderNumber(o.getOrderNumber())
                                .orderDate(o.getOrderDate())
                                .customerId(o.getCustomer().getId())
                                .customerName(o.getCustomer().getBusinessName())
                                .quantity(i.getQuantity())
                                .rate(i.getUnitPrice())
                                .amount(i.getLineTotal())
                                .build()))
                .sorted(Comparator.comparing(ReportDtos.ItemHistoryRow::getOrderDate)
                        .thenComparing(ReportDtos.ItemHistoryRow::getOrderNumber))
                .collect(Collectors.toList());

        return ReportDtos.ItemHistoryResponse.builder()
                .productId(product.getId()).productName(product.getName())
                .brand(product.getBrand()).unit(product.getUnit())
                .customerId(customerId).customerName(customerName)
                .from(from).to(to).rows(rows)
                .totalQty(rows.stream().mapToInt(ReportDtos.ItemHistoryRow::getQuantity).sum())
                .totalAmount(rows.stream().map(ReportDtos.ItemHistoryRow::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add))
                .distinctCustomers((int) rows.stream().map(ReportDtos.ItemHistoryRow::getCustomerId).distinct().count())
                .build();
    }

    /** Collapse order lines to one row per product (qty summed, amount summed), richest first. */
    private List<ReportDtos.ItemMovementRow> aggregateItems(List<OrderItem> items) {
        return items.stream()
                .filter(i -> i.getProduct() != null)
                .collect(Collectors.groupingBy(i -> i.getProduct().getId()))
                .values().stream()
                .map(list -> {
                    OrderItem s = list.get(0);
                    int qty = list.stream().mapToInt(OrderItem::getQuantity).sum();
                    BigDecimal amt = list.stream().map(OrderItem::getLineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
                    return ReportDtos.ItemMovementRow.builder()
                            .productId(s.getProduct().getId())
                            .productName(s.getProduct().getName())
                            .brand(s.getProduct().getBrand())
                            .unit(s.getProduct().getUnit())
                            .qty(qty).amount(amt).build();
                })
                .sorted(Comparator.comparing(ReportDtos.ItemMovementRow::getAmount).reversed())
                .collect(Collectors.toList());
    }

    // ─── Route Outstanding (dues grouped by route) ───────────────────────────

    public ReportDtos.RouteOutstandingResponse getRouteOutstanding(UUID tenantId, LocalDate asOfDate) {
        List<Customer> customers = customerRepository.findByTenantIdAndActiveTrueOrderByBusinessNameAsc(tenantId);

        Map<String, ReportDtos.RouteOutstandingRow> byRoute = new LinkedHashMap<>();
        int customersWithDues = 0;

        for (Customer c : customers) {
            List<Order> unpaid = orderRepository.findUnpaidOrdersByCustomer(tenantId, c.getId(), Order.OrderStatus.CANCELLED);
            if (unpaid.isEmpty()) continue;
            BigDecimal bal = unpaid.stream().map(Order::getBalanceAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            if (bal.signum() <= 0) continue;
            customersWithDues++;

            Route r = c.getRoute();
            UUID rid = r != null ? r.getId() : null;
            String key = rid != null ? rid.toString() : "__NONE__";
            String name = r != null ? r.getName() : "No Route";

            ReportDtos.RouteOutstandingRow row = byRoute.get(key);
            if (row == null) {
                row = ReportDtos.RouteOutstandingRow.builder()
                        .routeId(rid).routeName(name).customerCount(0).outstanding(BigDecimal.ZERO).build();
                byRoute.put(key, row);
            }
            row.setCustomerCount(row.getCustomerCount() + 1);
            row.setOutstanding(row.getOutstanding().add(bal));
        }

        List<ReportDtos.RouteOutstandingRow> rows = byRoute.values().stream()
                .sorted(Comparator.comparing(ReportDtos.RouteOutstandingRow::getOutstanding).reversed())
                .collect(Collectors.toList());

        return ReportDtos.RouteOutstandingResponse.builder()
                .asOfDate(asOfDate)
                .rows(rows)
                .routeCount(rows.size())
                .customerCount(customersWithDues)
                .totalOutstanding(rows.stream().map(ReportDtos.RouteOutstandingRow::getOutstanding).reduce(BigDecimal.ZERO, BigDecimal::add))
                .build();
    }

    // ─── GSTR-1 (monthly outward supplies return) ────────────────────────────

    /** Sales in this state are always CGST+SGST, split as equal halves of the line's GST. */
    private static final BigDecimal TWO = BigDecimal.valueOf(2);

    /** A valid GSTIN: 2-digit state code, PAN, entity code, 'Z', checksum. */
    private static final java.util.regex.Pattern GSTIN_PATTERN =
            java.util.regex.Pattern.compile("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");

    /** Statuses that mean a bill exists. Invoicing happens at APPROVED, so liability starts there. */
    private static final List<Order.OrderStatus> INVOICED_STATUSES = List.of(
            Order.OrderStatus.APPROVED, Order.OrderStatus.PACKING, Order.OrderStatus.PACKED,
            Order.OrderStatus.DISPATCHED, Order.OrderStatus.DELIVERED);

    /**
     * Builds the GSTR-1 tables for a period.
     *
     * Registered buyers (Table 4) are reported invoice-by-invoice so they can claim input credit;
     * unregistered buyers (Table 7) collapse into one figure per tax rate. The HSN summary
     * (Table 12) is mandatory, and verified sales returns become credit notes (Table 9B) that
     * reduce the output tax.
     *
     * Everything is driven off the line items, because an order-level discount is pushed down into
     * the lines when the bill is made — so the line figures are the authoritative ones.
     */
    public ReportDtos.Gstr1Response getGstr1(UUID tenantId, LocalDate from, LocalDate to) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        String homeState = tenant.getStateCode();

        List<OrderItem> items = orderRepository.findInvoicedItemsByTenantAndDateRange(
                tenantId, from, to, INVOICED_STATUSES);

        List<ReportDtos.Gstr1Problem> problems = new ArrayList<>();

        // Accumulators. LinkedHashMap/TreeMap keep the output in a stable, readable order.
        Map<String, Gstr1Bucket> b2bByInvoiceRate = new LinkedHashMap<>();
        Map<BigDecimal, Gstr1Bucket> b2csByRate = new java.util.TreeMap<>();
        Map<String, Gstr1Bucket> hsnByCodeRate = new LinkedHashMap<>();
        Map<UUID, Order> invoices = new LinkedHashMap<>();
        Set<UUID> b2bInvoices = new java.util.LinkedHashSet<>();
        Set<UUID> b2cInvoices = new java.util.LinkedHashSet<>();
        Set<String> malformedGstinsSeen = new java.util.HashSet<>();
        Set<String> missingHsnSeen = new java.util.HashSet<>();
        Set<UUID> interStateFlagged = new java.util.HashSet<>();

        for (OrderItem item : items) {
            Order order = item.getOrder();
            Customer customer = order.getCustomer();
            invoices.putIfAbsent(order.getId(), order);

            BigDecimal rate = nvl(item.getGstPercent());
            BigDecimal gst = nvl(item.getGstAmount());
            BigDecimal taxable = nvl(item.getLineTotal()).subtract(gst);

            String rawGstin = customer.getGstin() != null ? customer.getGstin().trim().toUpperCase() : "";
            boolean hasGstin = !rawGstin.isEmpty();
            boolean validGstin = hasGstin && GSTIN_PATTERN.matcher(rawGstin).matches();

            // A GSTIN that is present but malformed cannot be filed. The sale is reported as B2C so
            // the return still balances, and the customer is listed for correction.
            if (hasGstin && !validGstin && malformedGstinsSeen.add(customer.getId().toString())) {
                problems.add(ReportDtos.Gstr1Problem.builder()
                        .kind("MALFORMED_GSTIN")
                        .subject(customer.getBusinessName())
                        .detail("GSTIN \"" + rawGstin + "\" is not a valid 15-character GSTIN — "
                                + "this shop's sales are being reported as B2C, so it cannot claim input credit")
                        .build());
            }

            if (validGstin) {
                b2bInvoices.add(order.getId());
                String buyerState = rawGstin.substring(0, 2);
                boolean interState = homeState != null && !homeState.isBlank()
                        && !buyerState.equals(homeState);
                if (interState && interStateFlagged.add(order.getId())) {
                    problems.add(ReportDtos.Gstr1Problem.builder()
                            .kind("INTER_STATE_B2B")
                            .subject(order.getOrderNumber() + " — " + customer.getBusinessName())
                            .detail("Buyer is registered in state " + buyerState + " but we are in " + homeState
                                    + ". An inter-state sale carries IGST, not CGST+SGST — this bill's tax split "
                                    + "needs your accountant's review")
                            .amountAffected(nvl(order.getTotalAmount()))
                            .build());
                }
                String key = order.getId() + "|" + rate.toPlainString();
                b2bByInvoiceRate.computeIfAbsent(key, k ->
                        new Gstr1Bucket(order, customer, rawGstin, rate, buyerState, interState)).add(taxable, gst, 0);
            } else {
                b2cInvoices.add(order.getId());
                b2csByRate.computeIfAbsent(rate, r ->
                        new Gstr1Bucket(null, null, null, r, homeState, false)).add(taxable, gst, 0);
            }

            // HSN summary — mandatory, and incomplete without an HSN code on every product.
            String hsn = item.getProduct().getHsnCode();
            if (hsn == null || hsn.isBlank()) {
                if (missingHsnSeen.add(item.getProduct().getId().toString())) {
                    problems.add(ReportDtos.Gstr1Problem.builder()
                            .kind("MISSING_HSN")
                            .subject(item.getProduct().getName())
                            .detail("No HSN code on this product — the HSN summary (Table 12) is mandatory, "
                                    + "so this has to be filled in before filing")
                            .build());
                }
                hsn = "(not set)";
            }
            String hsnKey = hsn + "|" + rate.toPlainString();
            final String hsnCode = hsn;
            Gstr1Bucket hsnBucket = hsnByCodeRate.computeIfAbsent(hsnKey, k -> {
                Gstr1Bucket b = new Gstr1Bucket(null, null, null, rate, homeState, false);
                b.hsnCode = hsnCode;
                b.description = item.getProduct().getName();
                b.uqc = item.getProduct().getUnit();
                return b;
            });
            hsnBucket.add(taxable, gst, item.getQuantity());
        }

        // Count invoices that stop appearing here only because the order was never marked B2B/B2C —
        // every invoice belongs to exactly one bucket, so the two sets partition the invoice list.
        b2cInvoices.removeAll(b2bInvoices);

        List<ReportDtos.Gstr1B2bRow> b2bRows = b2bByInvoiceRate.values().stream()
                .map(b -> ReportDtos.Gstr1B2bRow.builder()
                        .gstin(b.gstin)
                        .customerName(b.customer.getBusinessName())
                        .invoiceNo(b.order.getOrderNumber())
                        .invoiceDate(b.order.getOrderDate())
                        .invoiceValue(nvl(b.order.getTotalAmount()))
                        .placeOfSupply(b.placeOfSupply)
                        .reverseCharge("N")
                        .rate(b.rate)
                        .taxableValue(b.taxable())
                        .cgst(b.cgst())
                        .sgst(b.sgst())
                        .interState(b.interState)
                        .build())
                .collect(Collectors.toList());

        List<ReportDtos.Gstr1B2csRow> b2csRows = b2csByRate.values().stream()
                .map(b -> ReportDtos.Gstr1B2csRow.builder()
                        .type("OE")
                        .placeOfSupply(b.placeOfSupply)
                        .rate(b.rate)
                        .taxableValue(b.taxable())
                        .cgst(b.cgst())
                        .sgst(b.sgst())
                        .invoiceCount(b2cInvoices.size())
                        .build())
                .collect(Collectors.toList());

        List<ReportDtos.Gstr1HsnRow> hsnRows = hsnByCodeRate.values().stream()
                .sorted(Comparator.comparing((Gstr1Bucket b) -> b.hsnCode)
                        .thenComparing(b -> b.rate))
                .map(b -> ReportDtos.Gstr1HsnRow.builder()
                        .hsnCode(b.hsnCode)
                        .description(b.description)
                        .uqc(b.uqc)
                        .totalQuantity(BigDecimal.valueOf(b.quantity))
                        .rate(b.rate)
                        .taxableValue(b.taxable())
                        .cgst(b.cgst())
                        .sgst(b.sgst())
                        .totalValue(b.taxable().add(b.cgst()).add(b.sgst()))
                        .build())
                .collect(Collectors.toList());

        List<ReportDtos.Gstr1CreditNoteRow> creditNotes = buildCreditNotes(tenantId, from, to);

        // Bills raised then sent back to the warehouse: still invoices, so they are surfaced rather
        // than dropped. Either cancel them or credit-note them before filing.
        for (Order stranded : orderRepository.findByTenantAndDateRangeAndSingleStatus(
                tenantId, from, to, Order.OrderStatus.RETURN_TO_WAREHOUSE)) {
            problems.add(ReportDtos.Gstr1Problem.builder()
                    .kind("INVOICED_NOT_DELIVERED")
                    .subject(stranded.getOrderNumber() + " — " + stranded.getCustomer().getBusinessName())
                    .detail("Bill was raised but the goods came back to the warehouse. It is excluded from "
                            + "this return — cancel it or raise a credit note so the books agree")
                    .amountAffected(nvl(stranded.getTotalAmount()))
                    .build());
        }

        BigDecimal b2bTaxable = sumTaxable(b2bByInvoiceRate.values());
        BigDecimal b2cTaxable = sumTaxable(b2csByRate.values());
        BigDecimal cgst = sumCgst(b2bByInvoiceRate.values()).add(sumCgst(b2csByRate.values()));
        BigDecimal sgst = sumSgst(b2bByInvoiceRate.values()).add(sumSgst(b2csByRate.values()));
        BigDecimal taxable = b2bTaxable.add(b2cTaxable);
        BigDecimal roundOff = invoices.values().stream()
                .map(o -> nvl(o.getRoundOffAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal invoiceValue = invoices.values().stream()
                .map(o -> nvl(o.getTotalAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal creditNoteTaxable = creditNotes.stream()
                .map(ReportDtos.Gstr1CreditNoteRow::getTaxableValue).reduce(BigDecimal.ZERO, BigDecimal::add);

        ReportDtos.Gstr1Totals totals = ReportDtos.Gstr1Totals.builder()
                .taxableValue(taxable)
                .cgst(cgst).sgst(sgst).totalTax(cgst.add(sgst))
                .roundOff(roundOff)
                .invoiceValue(invoiceValue)
                .b2bTaxableValue(b2bTaxable)
                .b2cTaxableValue(b2cTaxable)
                .creditNoteTaxableValue(creditNoteTaxable)
                .netTaxableValue(taxable.subtract(creditNoteTaxable))
                .build();

        ReportDtos.Gstr1DataQuality quality = ReportDtos.Gstr1DataQuality.builder()
                .companyGstinMissing(tenant.getGstin() == null || tenant.getGstin().isBlank())
                .companyStateCodeMissing(homeState == null || homeState.isBlank())
                .problems(problems)
                .problemCount(problems.size())
                .build();

        return ReportDtos.Gstr1Response.builder()
                .from(from).to(to)
                .companyGstin(tenant.getGstin())
                .companyStateCode(homeState)
                .invoiceCount(invoices.size())
                .b2bInvoiceCount(b2bInvoices.size())
                .b2cInvoiceCount(b2cInvoices.size())
                .totals(totals)
                .b2b(b2bRows)
                .b2cs(b2csRows)
                .hsn(hsnRows)
                .creditNotes(creditNotes)
                .dataQuality(quality)
                .build();
    }

    /**
     * Verified sales returns, as credit notes. Only returns from registered buyers are filed
     * invoice-wise; the rest simply net off the B2C figure, which the caller shows separately.
     */
    private List<ReportDtos.Gstr1CreditNoteRow> buildCreditNotes(UUID tenantId, LocalDate from, LocalDate to) {
        List<ReportDtos.Gstr1CreditNoteRow> rows = new ArrayList<>();

        for (com.stockez.api.module.goodsreturn.entity.GoodsReturn gr :
                goodsReturnRepository.findVerifiedSalesReturnsInPeriod(tenantId, from, to)) {

            Order origin = gr.getReferenceOrder();
            Customer customer = origin != null ? origin.getCustomer() : gr.getCustomer();
            String gstin = customer != null && customer.getGstin() != null
                    ? customer.getGstin().trim().toUpperCase() : "";
            boolean registered = GSTIN_PATTERN.matcher(gstin).matches();

            // One row per tax rate, same shape as the B2B table.
            Map<BigDecimal, BigDecimal[]> byRate = new java.util.TreeMap<>();
            for (com.stockez.api.module.goodsreturn.entity.GoodsReturnItem it : gr.getItems()) {
                // The warehouse may have received less than was filed; the credit follows what arrived.
                int qty = it.getReceivedQty() != null ? it.getReceivedQty() : it.getQuantity();
                if (qty <= 0) continue;

                BigDecimal rate = nvl(it.getGstPercent());
                BigDecimal lineValue = nvl(it.getUnitRate()).multiply(BigDecimal.valueOf(qty));
                BigDecimal gst = rate.compareTo(BigDecimal.ZERO) > 0
                        ? lineValue.multiply(rate).divide(BigDecimal.valueOf(100).add(rate), 2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;

                BigDecimal[] acc = byRate.computeIfAbsent(rate,
                        r -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
                acc[0] = acc[0].add(lineValue.subtract(gst));
                acc[1] = acc[1].add(gst);
            }

            for (Map.Entry<BigDecimal, BigDecimal[]> e : byRate.entrySet()) {
                BigDecimal noteTaxable = e.getValue()[0].setScale(2, RoundingMode.HALF_UP);
                BigDecimal noteGst = e.getValue()[1].setScale(2, RoundingMode.HALF_UP);
                BigDecimal half = noteGst.divide(TWO, 2, RoundingMode.HALF_UP);
                rows.add(ReportDtos.Gstr1CreditNoteRow.builder()
                        .noteNo(gr.getReturnNumber())
                        .noteDate(gr.getReturnDate())
                        .gstin(registered ? gstin : null)
                        .customerName(customer != null ? customer.getBusinessName() : null)
                        .originalInvoiceNo(origin != null ? origin.getOrderNumber() : null)
                        .originalInvoiceDate(origin != null ? origin.getOrderDate() : null)
                        .rate(e.getKey())
                        .taxableValue(noteTaxable)
                        .cgst(half).sgst(half)
                        .noteValue(noteTaxable.add(noteGst))
                        .registeredBuyer(registered)
                        .build());
            }
        }
        return rows;
    }

    private static BigDecimal sumTaxable(java.util.Collection<Gstr1Bucket> buckets) {
        return buckets.stream().map(Gstr1Bucket::taxable).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal sumCgst(java.util.Collection<Gstr1Bucket> buckets) {
        return buckets.stream().map(Gstr1Bucket::cgst).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal sumSgst(java.util.Collection<Gstr1Bucket> buckets) {
        return buckets.stream().map(Gstr1Bucket::sgst).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal nvl(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    /**
     * One GSTR-1 line under construction. Amounts accumulate at full precision and are only rounded
     * when read, so a rate bucket's total does not drift by a paisa per line.
     */
    private static final class Gstr1Bucket {
        private final Order order;
        private final Customer customer;
        private final String gstin;
        private final BigDecimal rate;
        private final String placeOfSupply;
        private final boolean interState;
        private BigDecimal taxableRaw = BigDecimal.ZERO;
        private BigDecimal gstRaw = BigDecimal.ZERO;
        private int quantity;
        private String hsnCode;
        private String description;
        private String uqc;

        Gstr1Bucket(Order order, Customer customer, String gstin, BigDecimal rate,
                    String placeOfSupply, boolean interState) {
            this.order = order;
            this.customer = customer;
            this.gstin = gstin;
            this.rate = rate;
            this.placeOfSupply = placeOfSupply;
            this.interState = interState;
        }

        void add(BigDecimal taxable, BigDecimal gst, int qty) {
            taxableRaw = taxableRaw.add(taxable);
            gstRaw = gstRaw.add(gst);
            quantity += qty;
        }

        BigDecimal taxable() { return taxableRaw.setScale(2, RoundingMode.HALF_UP); }
        BigDecimal cgst()    { return gstRaw.divide(TWO, 2, RoundingMode.HALF_UP); }
        BigDecimal sgst()    { return cgst(); }
    }
}
