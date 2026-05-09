package com.distroiq.api.module.order.service;

import com.distroiq.api.module.order.dto.OrderDtos;
import com.distroiq.api.module.order.entity.Order;
import com.distroiq.api.module.order.entity.Payment;
import com.distroiq.api.module.order.repository.OrderRepository;
import com.distroiq.api.module.order.repository.PaymentRepository;
import com.distroiq.api.module.payment.entity.PaymentMethod;
import com.distroiq.api.module.payment.repository.PaymentMethodRepository;
import com.distroiq.api.module.user.entity.User;
import com.distroiq.api.module.user.repository.UserRepository;
import com.distroiq.api.module.audit.service.AuditService;
import com.distroiq.common.exception.BusinessException;
import com.distroiq.common.exception.ResourceNotFoundException;
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
    private final AuditService auditService;

    public OrderDtos.PaymentResponse collectPayment(OrderDtos.CreatePaymentRequest req, UUID collectorId, UUID tenantId) {
        Order order = orderRepository.findByIdAndTenantId(req.getOrderId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", req.getOrderId().toString()));

        User collector = userRepository.findByIdAndTenantId(collectorId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", collectorId.toString()));

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

        Payment payment = Payment.builder()
                .tenant(order.getTenant())
                .order(order)
                .collectedBy(collector)
                .amount(req.getAmount())
                .paymentMode(resolvedMode)
                .paymentMethodName(resolvedMethodName)
                .referenceNumber(req.getReferenceNumber())
                .collectionDate(LocalDate.now())
                .notes(req.getNotes())
                .build();

        Payment saved = paymentRepository.save(payment);

        // Update order balances
        order.setPaidAmount(order.getPaidAmount().add(req.getAmount()));
        order.setBalanceAmount(order.getTotalAmount().subtract(order.getPaidAmount()));
        orderRepository.save(order);

        auditService.record(order.getTenant().getId(), "ORDER", order.getId(), "PAYMENT_COLLECTED",
                "Payment ₹" + req.getAmount().toPlainString() + " collected via " +
                (resolvedMethodName != null ? resolvedMethodName : resolvedMode.name()) +
                " by " + collector.getFullName() +
                (req.getReferenceNumber() != null ? " (Ref: " + req.getReferenceNumber() + ")" : ""));

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

    @Transactional(readOnly = true)
    public List<OrderDtos.CustomerOutstandingSummary> getCustomerOutstanding(UUID tenantId) {
        List<Object[]> rows = orderRepository.findCustomerOutstanding(tenantId, Order.OrderStatus.CANCELLED);

        Map<UUID, LocalDate> lastPaymentMap = paymentRepository.findLastPaymentDateByCustomer(tenantId)
                .stream()
                .collect(Collectors.toMap(
                    r -> (UUID) r[0],
                    r -> (LocalDate) r[1]
                ));

        return rows.stream().map(row -> {
            OrderDtos.CustomerOutstandingSummary s = new OrderDtos.CustomerOutstandingSummary();
            s.setCustomerId((UUID) row[0]);
            s.setBusinessName((String) row[1]);
            s.setOwnerName((String) row[2]);
            s.setPhone((String) row[3]);
            s.setRouteName((String) row[4]);
            s.setTotalOrdered((java.math.BigDecimal) row[5]);
            s.setTotalPaid((java.math.BigDecimal) row[6]);
            s.setOutstanding((java.math.BigDecimal) row[7]);
            s.setLastOrderDate((LocalDate) row[8]);
            s.setLastPaymentDate(lastPaymentMap.get((UUID) row[0]));
            s.setOrderCount(((Long) row[9]).intValue());
            return s;
        }).collect(Collectors.toList());
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
                    return s;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.PaymentResponse> getCustomerPaymentHistory(UUID customerId, UUID tenantId) {
        return paymentRepository.findByTenantIdAndOrder_CustomerIdOrderByCollectionDateAsc(tenantId, customerId)
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
