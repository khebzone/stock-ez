package com.stockez.api.module.order.service;

import com.stockez.api.module.order.dto.OrderDtos;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.Payment;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.goodsreturn.entity.GoodsReturn;
import com.stockez.api.module.goodsreturn.repository.GoodsReturnRepository;
import com.stockez.api.module.route.entity.RouteAllocation;
import com.stockez.api.module.route.repository.RouteAllocationRepository;
import com.stockez.api.module.payment.entity.PaymentMethod;
import com.stockez.api.module.payment.repository.PaymentMethodRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final PaymentMethodRepository paymentMethodRepository;
    private final RouteAllocationRepository routeAllocationRepository;
    private final GoodsReturnRepository goodsReturnRepository;
    private final AuditService auditService;

    public OrderDtos.PaymentResponse collectPayment(OrderDtos.CreatePaymentRequest req, UUID collectorId, UUID tenantId) {
        Order order = orderRepository.findByIdAndTenantId(req.getOrderId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", req.getOrderId().toString()));

        User collector = userRepository.findByIdAndTenantId(collectorId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", collectorId.toString()));

        if (!req.isAutoSubmit() && paymentRepository.existsByTenantIdAndCollectedByIdAndCollectionDateAndSubmittedTrue(
                tenantId, collectorId, LocalDate.now())) {
            throw new BusinessException(
                "Day collections already submitted to accountant. No further payments can be collected today.",
                "COLLECTIONS_SUBMITTED");
        }

        if (req.getAmount().compareTo(order.getBalanceAmount()) > 0) {
            throw new BusinessException("Payment amount exceeds balance of " + order.getBalanceAmount(), "OVERPAYMENT");
        }

        // Resolve payment mode and method name from paymentMethodId if provided
        Payment.PaymentMode resolvedMode = req.getPaymentMode();
        String resolvedMethodName = null;
        if (req.getPaymentMethodId() != null) {
            PaymentMethod method = paymentMethodRepository.findByIdAndTenantId(req.getPaymentMethodId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("PaymentMethod", req.getPaymentMethodId().toString()));
            resolvedMode = Payment.PaymentMode.valueOf(method.getMode());
            resolvedMethodName = method.getName();
        }
        if (resolvedMode == null) {
            throw new BusinessException("Payment mode is required", "MISSING_PAYMENT_MODE");
        }

        // Collection date: field staff always record on today; office staff may back-date
        // (the controller strips the date unless the caller is allowed to back-date).
        LocalDate collectionDate = req.getCollectionDate() != null ? req.getCollectionDate() : LocalDate.now();
        if (collectionDate.isAfter(LocalDate.now())) {
            throw new BusinessException("Collection date cannot be in the future", "INVALID_COLLECTION_DATE");
        }

        boolean isInstrument = resolvedMode == Payment.PaymentMode.CHEQUE
                || resolvedMode == Payment.PaymentMode.NEFT
                || resolvedMode == Payment.PaymentMode.RTGS;

        if (isInstrument && (req.getReferenceNumber() == null || req.getReferenceNumber().isBlank())) {
            String label = resolvedMode == Payment.PaymentMode.CHEQUE ? "Cheque number" : "Transaction/UTR reference";
            throw new BusinessException(label + " is required for " + resolvedMode.name() + " payments", "REFERENCE_REQUIRED");
        }

        Payment payment = Payment.builder()
                .tenant(order.getTenant())
                .order(order)
                .customer(order.getCustomer())
                .collectedBy(collector)
                .amount(req.getAmount())
                .paymentMode(resolvedMode)
                .paymentMethodName(resolvedMethodName)
                .referenceNumber(req.getReferenceNumber())
                .collectionDate(collectionDate)
                .instrumentDate(isInstrument ? req.getInstrumentDate() : null)
                .draweeBank(isInstrument ? req.getDraweeBank() : null)
                .status(isInstrument ? Payment.PaymentStatus.PENDING : Payment.PaymentStatus.REALISED)
                .realisedDate(isInstrument ? null : collectionDate)
                .submitted(req.isAutoSubmit())
                .submittedAt(req.isAutoSubmit() ? Instant.now() : null)
                .notes(req.getNotes())
                .build();

        Payment saved = paymentRepository.save(payment);

        // Cash / UPI settle instantly → reduce the order balance now.
        // Instruments (cheque, NEFT, RTGS) only reduce the balance once realised in the bank.
        if (!isInstrument) {
            order.setPaidAmount(order.getPaidAmount().add(req.getAmount()));
            order.setBalanceAmount(order.getTotalAmount().subtract(order.getPaidAmount()));
            orderRepository.save(order);
        }

        auditService.record(order.getTenant().getId(), "ORDER", order.getId(), "PAYMENT_COLLECTED",
                "Payment ₹" + req.getAmount().toPlainString() + " collected via " +
                (resolvedMethodName != null ? resolvedMethodName : resolvedMode.name()) +
                " by " + collector.getFullName() +
                (req.getReferenceNumber() != null ? " (Ref: " + req.getReferenceNumber() + ")" : "") +
                (isInstrument ? " — awaiting bank realisation" : ""));

        return toPaymentResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.DailySummaryResponse> getDailyCollections(UUID tenantId, LocalDate date) {
        List<Payment> payments = paymentRepository.findByTenantIdAndCollectionDate(tenantId, date);

        Map<UUID, List<Payment>> byPerson = payments.stream()
                .collect(Collectors.groupingBy(p -> p.getCollectedBy().getId()));

        List<OrderDtos.DailySummaryResponse> summaries = new ArrayList<>();
        byPerson.forEach((personId, personPayments) -> {
            User person = personPayments.get(0).getCollectedBy();
            OrderDtos.DailySummaryResponse summary = new OrderDtos.DailySummaryResponse();
            summary.setPersonId(personId);
            summary.setPersonName(person.getFullName());
            summary.setPhone(person.getPhone());

            BigDecimal total = BigDecimal.ZERO, cash = BigDecimal.ZERO, upi = BigDecimal.ZERO,
                       cheque = BigDecimal.ZERO, credit = BigDecimal.ZERO;
            boolean allCleared = true;

            for (Payment p : personPayments) {
                total = total.add(p.getAmount());
                if (!p.isCleared()) allCleared = false;
                switch (p.getPaymentMode()) {
                    case CASH -> cash = cash.add(p.getAmount());
                    case UPI -> upi = upi.add(p.getAmount());
                    case CHEQUE -> cheque = cheque.add(p.getAmount());
                    case CREDIT -> credit = credit.add(p.getAmount());
                    default -> {}
                }
            }

            summary.setTotalCollected(total);
            summary.setCashAmount(cash);
            summary.setUpiAmount(upi);
            summary.setChequeAmount(cheque);
            summary.setCreditAmount(credit);
            summary.setAllCleared(allCleared);
            summary.setPayments(personPayments.stream().map(this::toPaymentResponse).collect(Collectors.toList()));
            summaries.add(summary);
        });

        return summaries;
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.PaymentResponse> getUnclearedPayments(UUID personId, UUID tenantId) {
        return paymentRepository.findByTenantIdAndCollectedByIdAndClearedFalse(tenantId, personId)
                .stream().map(this::toPaymentResponse).collect(Collectors.toList());
    }

    /**
     * Sales/delivery person gets their own today's collection summary.
     */
    @Transactional(readOnly = true)
    public OrderDtos.MyDaySummaryResponse getMyDayCollections(UUID personId, UUID tenantId) {
        List<Payment> payments = paymentRepository
                .findByTenantIdAndCollectedByIdAndCollectionDate(tenantId, personId, LocalDate.now());

        OrderDtos.MyDaySummaryResponse res = new OrderDtos.MyDaySummaryResponse();
        res.setDate(LocalDate.now());

        BigDecimal total = BigDecimal.ZERO, cash = BigDecimal.ZERO, upi = BigDecimal.ZERO,
                   cheque = BigDecimal.ZERO, neft = BigDecimal.ZERO, rtgs = BigDecimal.ZERO,
                   credit = BigDecimal.ZERO;
        boolean allSubmitted = !payments.isEmpty();

        for (Payment p : payments) {
            total = total.add(p.getAmount());
            if (!p.isSubmitted()) allSubmitted = false;
            switch (p.getPaymentMode()) {
                case CASH   -> cash   = cash.add(p.getAmount());
                case UPI    -> upi    = upi.add(p.getAmount());
                case CHEQUE -> cheque = cheque.add(p.getAmount());
                case NEFT   -> neft   = neft.add(p.getAmount());
                case RTGS   -> rtgs   = rtgs.add(p.getAmount());
                case CREDIT -> credit = credit.add(p.getAmount());
            }
        }

        res.setTotalCollected(total);
        res.setCashAmount(cash);
        res.setUpiAmount(upi);
        res.setChequeAmount(cheque);
        res.setNeftAmount(neft);
        res.setRtgsAmount(rtgs);
        res.setCreditAmount(credit);
        res.setTotalPayments(payments.size());
        res.setAllSubmitted(allSubmitted);
        res.setPayments(payments.stream().map(this::toPaymentResponse).collect(Collectors.toList()));
        return res;
    }

    /**
     * Sales/delivery person submits all today's unsubmitted collections to accountant.
     */
    public OrderDtos.MyDaySummaryResponse submitDayCollections(UUID personId, UUID tenantId) {
        long unverifiedReturns = goodsReturnRepository.countByTenantIdAndCreatedByIdAndWarehouseStatus(
                tenantId, personId, GoodsReturn.WarehouseStatus.PENDING_VERIFICATION);
        if (unverifiedReturns > 0) {
            throw new BusinessException(
                "Nobody has verified your returns yet. Please ask the warehouse to verify the returned goods, then submit your collections.",
                "RETURNS_NOT_VERIFIED");
        }

        List<Payment> payments = paymentRepository
                .findByTenantIdAndCollectedByIdAndCollectionDate(tenantId, personId, LocalDate.now());

        Instant now = Instant.now();
        boolean anySubmitted = false;
        for (Payment p : payments) {
            if (!p.isSubmitted()) {
                p.setSubmitted(true);
                p.setSubmittedAt(now);
                anySubmitted = true;
            }
        }
        if (!anySubmitted) {
            throw new BusinessException("No unsubmitted payments found for today", "NOTHING_TO_SUBMIT");
        }
        paymentRepository.saveAll(payments);
        return getMyDayCollections(personId, tenantId);
    }

    /**
     * Accountant views all submitted-but-uncleared collections grouped by person.
     */
    @Transactional(readOnly = true)
    public List<OrderDtos.DailySummaryResponse> getPendingVerifications(UUID tenantId) {
        List<Payment> payments = paymentRepository.findByTenantIdAndSubmittedTrueAndClearedFalse(tenantId);

        Map<UUID, List<Payment>> byPerson = payments.stream()
                .collect(Collectors.groupingBy(p -> p.getCollectedBy().getId()));

        List<OrderDtos.DailySummaryResponse> summaries = new ArrayList<>();
        byPerson.forEach((personId, personPayments) -> {
            User person = personPayments.get(0).getCollectedBy();
            OrderDtos.DailySummaryResponse summary = new OrderDtos.DailySummaryResponse();
            summary.setPersonId(personId);
            summary.setPersonName(person.getFullName());
            summary.setPhone(person.getPhone());

            BigDecimal total = BigDecimal.ZERO, cash = BigDecimal.ZERO, upi = BigDecimal.ZERO,
                       cheque = BigDecimal.ZERO, credit = BigDecimal.ZERO;

            for (Payment p : personPayments) {
                total = total.add(p.getAmount());
                switch (p.getPaymentMode()) {
                    case CASH   -> cash   = cash.add(p.getAmount());
                    case UPI    -> upi    = upi.add(p.getAmount());
                    case CHEQUE -> cheque = cheque.add(p.getAmount());
                    case CREDIT -> credit = credit.add(p.getAmount());
                    default     -> {}
                }
            }
            summary.setTotalCollected(total);
            summary.setCashAmount(cash);
            summary.setUpiAmount(upi);
            summary.setChequeAmount(cheque);
            summary.setCreditAmount(credit);
            summary.setAllCleared(false);
            summary.setPayments(personPayments.stream().map(this::toPaymentResponse).collect(Collectors.toList()));
            summaries.add(summary);
        });
        return summaries;
    }

    public void clearPayments(OrderDtos.ClearPaymentsRequest req, UUID accountantId, UUID tenantId) {
        User accountant = userRepository.findByIdAndTenantId(accountantId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", accountantId.toString()));

        List<Payment> payments = paymentRepository.findByIdInAndTenantId(req.getPaymentIds(), tenantId);
        if (payments.size() != req.getPaymentIds().size()) {
            throw new BusinessException("Some payments not found", "PAYMENT_NOT_FOUND");
        }

        Instant now = Instant.now();
        payments.forEach(p -> {
            p.setCleared(true);
            p.setClearedAt(now);
            p.setVerifiedBy(accountant);
        });
        paymentRepository.saveAll(payments);

        payments.stream().collect(java.util.stream.Collectors.groupingBy(p -> p.getOrder().getId()))
                .forEach((orderId, orderPayments) -> {
                    BigDecimal total = orderPayments.stream().map(Payment::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    auditService.record(tenantId, "ORDER", orderId, "PAYMENT_CLEARED",
                            "₹" + total.toPlainString() + " cleared by " + accountant.getFullName());
                });
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.PaymentResponse> getPaymentsByOrder(UUID orderId, UUID tenantId) {
        return paymentRepository.findByOrderId(orderId).stream()
                .map(this::toPaymentResponse).collect(Collectors.toList());
    }

    // ─── Cheque / Bank instrument clearance ───────────────────────────────────

    /** All cheque / NEFT / RTGS payments — the accountant's bank clearance worklist. */
    @Transactional(readOnly = true)
    public List<OrderDtos.PaymentResponse> getInstruments(UUID tenantId) {
        return paymentRepository.findInstruments(tenantId).stream()
                .map(this::toPaymentResponse).collect(Collectors.toList());
    }

    private Payment loadInstrument(UUID paymentId, UUID tenantId) {
        Payment p = paymentRepository.findByIdInAndTenantId(List.of(paymentId), tenantId).stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId.toString()));
        if (!p.isInstrument()) {
            throw new BusinessException("Only cheque / bank transfers go through bank clearance", "NOT_AN_INSTRUMENT");
        }
        return p;
    }

    public OrderDtos.PaymentResponse depositInstrument(UUID paymentId, OrderDtos.DepositInstrumentRequest req, UUID tenantId) {
        Payment p = loadInstrument(paymentId, tenantId);
        if (p.getStatus() != Payment.PaymentStatus.PENDING) {
            throw new BusinessException("Only pending instruments can be deposited", "INVALID_STATUS");
        }
        p.setStatus(Payment.PaymentStatus.DEPOSITED);
        p.setDepositDate(req.getDepositDate() != null ? req.getDepositDate() : LocalDate.now());
        p.setDepositBank(req.getDepositBank());
        paymentRepository.save(p);

        auditService.record(tenantId, "PAYMENT", p.getId(), "INSTRUMENT_DEPOSITED",
                p.getPaymentMode().name() + " ₹" + p.getAmount().toPlainString() +
                " (Ref: " + p.getReferenceNumber() + ") deposited" +
                (p.getDepositBank() != null ? " to " + p.getDepositBank() : ""));
        return toPaymentResponse(p);
    }

    /** Bank confirmed the money landed → reduce the order balance now. */
    public OrderDtos.PaymentResponse realiseInstrument(UUID paymentId, OrderDtos.RealiseInstrumentRequest req, UUID tenantId) {
        Payment p = loadInstrument(paymentId, tenantId);
        if (p.getStatus() == Payment.PaymentStatus.REALISED) {
            throw new BusinessException("Instrument already realised", "INVALID_STATUS");
        }
        if (p.getStatus() == Payment.PaymentStatus.BOUNCED) {
            throw new BusinessException("Bounced instrument cannot be realised", "INVALID_STATUS");
        }
        p.setStatus(Payment.PaymentStatus.REALISED);
        p.setRealisedDate(req.getRealisedDate() != null ? req.getRealisedDate() : LocalDate.now());
        paymentRepository.save(p);

        Order order = p.getOrder();
        if (order != null) {
            order.setPaidAmount(order.getPaidAmount().add(p.getAmount()));
            order.setBalanceAmount(order.getTotalAmount().subtract(order.getPaidAmount()));
            orderRepository.save(order);
            auditService.record(tenantId, "ORDER", order.getId(), "PAYMENT_REALISED",
                    p.getPaymentMode().name() + " ₹" + p.getAmount().toPlainString() +
                    " (Ref: " + p.getReferenceNumber() + ") realised in bank");
        }
        return toPaymentResponse(p);
    }

    /** Bank returned the instrument. No balance was ever reduced, so nothing to reverse on the order. */
    public OrderDtos.PaymentResponse bounceInstrument(UUID paymentId, OrderDtos.BounceInstrumentRequest req, UUID tenantId) {
        Payment p = loadInstrument(paymentId, tenantId);
        if (p.getStatus() == Payment.PaymentStatus.REALISED) {
            throw new BusinessException("A realised instrument cannot be bounced", "INVALID_STATUS");
        }
        if (p.getStatus() == Payment.PaymentStatus.BOUNCED) {
            throw new BusinessException("Instrument already marked bounced", "INVALID_STATUS");
        }
        p.setStatus(Payment.PaymentStatus.BOUNCED);
        p.setBounceReason(req.getBounceReason());
        p.setBankCharges(req.getBankCharges());
        paymentRepository.save(p);

        UUID orderId = p.getOrder() != null ? p.getOrder().getId() : p.getId();
        auditService.record(tenantId, p.getOrder() != null ? "ORDER" : "PAYMENT", orderId, "PAYMENT_BOUNCED",
                p.getPaymentMode().name() + " ₹" + p.getAmount().toPlainString() +
                " (Ref: " + p.getReferenceNumber() + ") BOUNCED — " + req.getBounceReason() +
                (req.getBankCharges() != null && req.getBankCharges().signum() > 0
                        ? " | bank charges ₹" + req.getBankCharges().toPlainString() : "") +
                " — customer balance remains due");
        return toPaymentResponse(p);
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.CustomerOutstandingSummary> getCustomerOutstanding(UUID tenantId, UUID userId) {
        User user = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        List<Order> orders;
        // Field workers (salesman / delivery) see only their allocated routes.
        // Admins and office staff see every customer's outstanding.
        boolean isFieldWorker = user.getRole() == User.UserRole.SALES
                || user.getRole() == User.UserRole.DELIVERY
                || (user.getCustomRole() != null && user.getCustomRole().isFieldStaff());
        if (isFieldWorker) {
            List<RouteAllocation> salesAllocations = routeAllocationRepository.findByTenantIdAndSalesPersonIdAndAllocationDate(tenantId, userId, LocalDate.now());
            List<RouteAllocation> deliveryAllocations = routeAllocationRepository.findByTenantIdAndDeliveryPersonIdAndAllocationDate(tenantId, userId, LocalDate.now());
            List<RouteAllocation> allocations = new ArrayList<>();
            allocations.addAll(salesAllocations);
            allocations.addAll(deliveryAllocations);

            if (allocations.isEmpty()) {
                return Collections.emptyList();
            }

            List<UUID> routeIds = allocations.stream().map(a -> a.getRoute().getId()).distinct().collect(Collectors.toList());
            orders = orderRepository.findByTenantIdAndStatusNotAndBalanceAmountGreaterThan(tenantId, Order.OrderStatus.CANCELLED, java.math.BigDecimal.ZERO)
                    .stream()
                    .filter(o -> o.getCustomer() != null && o.getCustomer().getRoute() != null && routeIds.contains(o.getCustomer().getRoute().getId()))
                    .collect(Collectors.toList());
        } else {
            orders = orderRepository.findByTenantIdAndStatusNotAndBalanceAmountGreaterThan(tenantId, Order.OrderStatus.CANCELLED, java.math.BigDecimal.ZERO);
        }

        Map<UUID, LocalDate> lastPaymentMap = paymentRepository.findLastPaymentDateByCustomer(tenantId)
                .stream()
                .collect(Collectors.toMap(
                    r -> (UUID) r[0],
                    r -> {
                        Object d = r[1];
                        return d instanceof LocalDate ? (LocalDate) d : ((java.sql.Date) d).toLocalDate();
                    }
                ));

        Map<UUID, List<Order>> byCustomer = orders.stream()
                .filter(o -> o.getCustomer() != null)
                .collect(Collectors.groupingBy(o -> o.getCustomer().getId()));

        return byCustomer.entrySet().stream().map(e -> {
            List<Order> cos = e.getValue();
            Order sample = cos.get(0);
            com.stockez.api.module.customer.entity.Customer c = sample.getCustomer();

            java.math.BigDecimal totalOrdered = cos.stream().map(Order::getTotalAmount).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            java.math.BigDecimal totalPaid    = cos.stream().map(Order::getPaidAmount).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            java.math.BigDecimal outstanding  = cos.stream().map(Order::getBalanceAmount).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            LocalDate lastOrderDate = cos.stream().map(Order::getOrderDate).max(Comparator.naturalOrder()).orElse(null);
            LocalDate oldestUnpaidOrderDate = cos.stream().map(Order::getOrderDate).min(Comparator.naturalOrder()).orElse(null);

            OrderDtos.CustomerOutstandingSummary s = new OrderDtos.CustomerOutstandingSummary();
            s.setCustomerId(c.getId());
            s.setBusinessName(c.getBusinessName());
            s.setOwnerName(c.getOwnerName());
            s.setPhone(c.getPhone());
            s.setRouteId(c.getRoute() != null ? c.getRoute().getId() : null);
            s.setRouteName(c.getRoute() != null ? c.getRoute().getName() : null);
            s.setRoutePlaceId(c.getRoutePlace() != null ? c.getRoutePlace().getId() : null);
            s.setRoutePlaceName(c.getRoutePlace() != null ? c.getRoutePlace().getName() : null);
            s.setTotalOrdered(totalOrdered);
            s.setTotalPaid(totalPaid);
            s.setOutstanding(outstanding);
            s.setLastOrderDate(lastOrderDate);
            s.setLastPaymentDate(lastPaymentMap.get(c.getId()));
            s.setOldestUnpaidOrderDate(oldestUnpaidOrderDate);
            s.setOrderCount(cos.size());
            return s;
        })
        .sorted(Comparator.comparing(OrderDtos.CustomerOutstandingSummary::getOutstanding).reversed())
        .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.RouteOutstandingGroup> getRouteOutstanding(UUID tenantId) {
        List<Order> orders = orderRepository.findByTenantIdAndStatusNotAndBalanceAmountGreaterThan(
                tenantId, Order.OrderStatus.CANCELLED, BigDecimal.ZERO);

        Map<UUID, LocalDate> lastPaymentMap = paymentRepository.findLastPaymentDateByCustomer(tenantId)
                .stream()
                .collect(Collectors.toMap(
                    r -> (UUID) r[0],
                    r -> {
                        Object d = r[1];
                        return d instanceof LocalDate ? (LocalDate) d : ((java.sql.Date) d).toLocalDate();
                    }
                ));

        Map<UUID, List<Order>> byCustomer = orders.stream()
                .filter(o -> o.getCustomer() != null)
                .collect(Collectors.groupingBy(o -> o.getCustomer().getId()));

        Map<String, List<OrderDtos.CustomerOutstandingSummary>> byRouteName = new LinkedHashMap<>();
        Map<String, UUID> routeNameToId = new LinkedHashMap<>();

        byCustomer.entrySet().stream()
            .map(e -> {
                List<Order> cos = e.getValue();
                Order sample = cos.get(0);
                com.stockez.api.module.customer.entity.Customer c = sample.getCustomer();

                BigDecimal totalOrdered = cos.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal totalPaid    = cos.stream().map(Order::getPaidAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal outstanding  = cos.stream().map(Order::getBalanceAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                LocalDate lastOrderDate         = cos.stream().map(Order::getOrderDate).max(Comparator.naturalOrder()).orElse(null);
                LocalDate oldestUnpaidOrderDate = cos.stream().map(Order::getOrderDate).min(Comparator.naturalOrder()).orElse(null);

                OrderDtos.CustomerOutstandingSummary s = new OrderDtos.CustomerOutstandingSummary();
                s.setCustomerId(c.getId());
                s.setBusinessName(c.getBusinessName());
                s.setOwnerName(c.getOwnerName());
                s.setPhone(c.getPhone());
                s.setRouteName(c.getRoute() != null ? c.getRoute().getName() : null);
                s.setTotalOrdered(totalOrdered);
                s.setTotalPaid(totalPaid);
                s.setOutstanding(outstanding);
                s.setLastOrderDate(lastOrderDate);
                s.setLastPaymentDate(lastPaymentMap.get(c.getId()));
                s.setOldestUnpaidOrderDate(oldestUnpaidOrderDate);
                s.setOrderCount(cos.size());

                String routeKey  = c.getRoute() != null ? c.getRoute().getName() : "No Route";
                UUID   routeId   = c.getRoute() != null ? c.getRoute().getId()   : null;
                return new Object[]{ s, routeKey, routeId };
            })
            .sorted(Comparator.comparing(arr -> (String) arr[1]))
            .forEach(arr -> {
                OrderDtos.CustomerOutstandingSummary s = (OrderDtos.CustomerOutstandingSummary) arr[0];
                String routeKey = (String) arr[1];
                UUID   routeId  = (UUID)   arr[2];
                byRouteName.computeIfAbsent(routeKey, k -> new ArrayList<>()).add(s);
                routeNameToId.putIfAbsent(routeKey, routeId);
            });

        return byRouteName.entrySet().stream().map(e -> {
            List<OrderDtos.CustomerOutstandingSummary> customers = e.getValue().stream()
                    .sorted(Comparator.comparing(OrderDtos.CustomerOutstandingSummary::getOutstanding).reversed())
                    .collect(Collectors.toList());
            BigDecimal total = customers.stream().map(OrderDtos.CustomerOutstandingSummary::getOutstanding)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            OrderDtos.RouteOutstandingGroup g = new OrderDtos.RouteOutstandingGroup();
            g.setRouteId(routeNameToId.get(e.getKey()));
            g.setRouteName(e.getKey());
            g.setCustomerCount(customers.size());
            g.setTotalOutstanding(total);
            g.setCustomers(customers);
            return g;
        })
        .sorted(Comparator.comparing(OrderDtos.RouteOutstandingGroup::getTotalOutstanding).reversed())
        .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.OrderSummary> getUnpaidOrdersByCustomer(UUID customerId, UUID tenantId) {
        return orderRepository.findUnpaidOrdersByCustomer(tenantId, customerId, Order.OrderStatus.CANCELLED)
                .stream()
                .map(o -> {
                    OrderDtos.OrderSummary s = new OrderDtos.OrderSummary();
                    s.setId(o.getId());
                    s.setOrderNumber(o.getOrderNumber());
                    s.setStatus(o.getStatus());
                    s.setOrderDate(o.getOrderDate());
                    s.setCustomerName(o.getCustomer().getBusinessName());
                    s.setTotalAmount(o.getTotalAmount());
                    s.setPaidAmount(o.getPaidAmount());
                    s.setBalanceAmount(o.getBalanceAmount());
                    s.setOpeningBalance(o.isOpeningBalance());
                    return s;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.SalesmanCreditSummary> getSalesmanCreditOutstanding(UUID tenantId) {
        List<Order> orders = orderRepository.findByTenantIdAndStatusNotAndBalanceAmountGreaterThan(
                tenantId, Order.OrderStatus.CANCELLED, java.math.BigDecimal.ZERO);

        Map<UUID, List<Order>> bySalesman = orders.stream()
                .filter(o -> o.getSalesPerson() != null)
                .collect(Collectors.groupingBy(o -> o.getSalesPerson().getId()));

        return bySalesman.entrySet().stream().map(e -> {
            List<Order> salesOrders = e.getValue();
            com.stockez.api.module.user.entity.User salesperson = salesOrders.get(0).getSalesPerson();

            java.math.BigDecimal totalCreditGiven = salesOrders.stream().map(Order::getTotalAmount)
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            java.math.BigDecimal totalCollected = salesOrders.stream().map(Order::getPaidAmount)
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            java.math.BigDecimal totalPending = salesOrders.stream().map(Order::getBalanceAmount)
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            long customerCount = salesOrders.stream()
                    .filter(o -> o.getCustomer() != null)
                    .map(o -> o.getCustomer().getId())
                    .distinct().count();

            List<OrderDtos.SalesmanCreditOrderRow> orderRows = salesOrders.stream()
                    .sorted(Comparator.comparing(Order::getOrderDate))
                    .map(o -> {
                        OrderDtos.SalesmanCreditOrderRow row = new OrderDtos.SalesmanCreditOrderRow();
                        row.setOrderId(o.getId());
                        row.setOrderNumber(o.getOrderNumber());
                        row.setOrderDate(o.getOrderDate());
                        row.setCustomerName(o.getCustomer() != null ? o.getCustomer().getBusinessName() : "");
                        row.setRouteName(o.getCustomer() != null && o.getCustomer().getRoute() != null ? o.getCustomer().getRoute().getName() : "");
                        row.setTotalAmount(o.getTotalAmount());
                        row.setPaidAmount(o.getPaidAmount());
                        row.setBalanceAmount(o.getBalanceAmount());
                        row.setOpeningBalance(o.isOpeningBalance());
                        return row;
                    }).collect(Collectors.toList());

            OrderDtos.SalesmanCreditSummary summary = new OrderDtos.SalesmanCreditSummary();
            summary.setSalesPersonId(salesperson.getId());
            summary.setSalesPersonName(salesperson.getFullName());
            summary.setPhone(salesperson.getPhone());
            summary.setOrderCount(salesOrders.size());
            summary.setCustomerCount((int) customerCount);
            summary.setTotalCreditGiven(totalCreditGiven);
            summary.setTotalCollected(totalCollected);
            summary.setTotalPending(totalPending);
            summary.setOrders(orderRows);
            return summary;
        })
        .sorted(Comparator.comparing(OrderDtos.SalesmanCreditSummary::getTotalPending).reversed())
        .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.PaymentResponse> getCustomerPaymentHistory(UUID customerId, UUID tenantId) {
        return paymentRepository.findByTenantIdAndCustomerIdOrderByCollectionDateAsc(tenantId, customerId)
                .stream()
                .map(this::toPaymentResponse)
                .collect(Collectors.toList());
    }

    private OrderDtos.PaymentResponse toPaymentResponse(Payment p) {
        OrderDtos.PaymentResponse res = new OrderDtos.PaymentResponse();
        res.setId(p.getId());
        res.setAmount(p.getAmount());
        res.setPaymentMode(p.getPaymentMode());
        res.setPaymentMethodName(p.getPaymentMethodName());
        res.setReferenceNumber(p.getReferenceNumber());
        res.setCollectionDate(p.getCollectionDate());
        res.setCleared(p.isCleared());
        res.setClearedAt(p.getClearedAt());
        res.setSubmitted(p.isSubmitted());
        res.setSubmittedAt(p.getSubmittedAt());
        res.setStatus(p.getStatus());
        res.setInstrumentDate(p.getInstrumentDate());
        res.setDepositDate(p.getDepositDate());
        res.setRealisedDate(p.getRealisedDate());
        res.setDraweeBank(p.getDraweeBank());
        res.setDepositBank(p.getDepositBank());
        res.setBounceReason(p.getBounceReason());
        res.setBankCharges(p.getBankCharges());
        if (p.getCustomer() != null) {
            res.setCustomerName(p.getCustomer().getBusinessName());
        }
        res.setNotes(p.getNotes());
        res.setCreatedAt(p.getCreatedAt());

        if (p.getCollectedBy() != null) {
            OrderDtos.PersonInfo ci = new OrderDtos.PersonInfo();
            ci.setId(p.getCollectedBy().getId());
            ci.setFullName(p.getCollectedBy().getFullName());
            ci.setPhone(p.getCollectedBy().getPhone());
            res.setCollectedBy(ci);
        }
        if (p.getVerifiedBy() != null) {
            OrderDtos.PersonInfo vi = new OrderDtos.PersonInfo();
            vi.setId(p.getVerifiedBy().getId());
            vi.setFullName(p.getVerifiedBy().getFullName());
            vi.setPhone(p.getVerifiedBy().getPhone());
            res.setVerifiedBy(vi);
        }
        if (p.getOrder() != null) {
            OrderDtos.OrderSummary os = new OrderDtos.OrderSummary();
            os.setId(p.getOrder().getId());
            os.setOrderNumber(p.getOrder().getOrderNumber());
            os.setStatus(p.getOrder().getStatus());
            os.setTotalAmount(p.getOrder().getTotalAmount());
            os.setBalanceAmount(p.getOrder().getBalanceAmount());
            os.setOrderDate(p.getOrder().getOrderDate());
            if (p.getOrder().getCustomer() != null) {
                os.setCustomerName(p.getOrder().getCustomer().getBusinessName());
            }
            res.setOrder(os);
        }
        return res;
    }
}
