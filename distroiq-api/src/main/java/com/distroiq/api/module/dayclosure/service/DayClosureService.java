package com.distroiq.api.module.dayclosure.service;

import com.distroiq.api.module.dayclosure.dto.DayClosureDtos;
import com.distroiq.api.module.dayclosure.entity.DayClosure;
import com.distroiq.api.module.dayclosure.repository.DayClosureRepository;
import com.distroiq.api.module.order.entity.Payment;
import com.distroiq.api.module.order.repository.PaymentRepository;
import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.tenant.repository.TenantRepository;
import com.distroiq.api.module.user.entity.User;
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
public class DayClosureService {

    private final DayClosureRepository dayClosureRepository;
    private final PaymentRepository paymentRepository;
    private final TenantRepository tenantRepository;

    // ─── 1. Get Today's Counter ───────────────────────────────────────────────

    public DayClosureDtos.TodayCounterResponse getTodayCounter(UUID tenantId) {
        LocalDate today = LocalDate.now();

        // Check if already closed for today
        Optional<DayClosure> existingOpt = dayClosureRepository.findByTenantIdAndClosureDate(tenantId, today);

        // Fetch today's payments for this tenant
        List<Payment> payments = paymentRepository.findByTenantIdAndCollectionDate(tenantId, today);

        // Sum by payment mode
        BigDecimal totalCash = sumByMode(payments, Payment.PaymentMode.CASH);
        BigDecimal totalUpi = sumByMode(payments, Payment.PaymentMode.UPI);
        BigDecimal totalCheque = sumByMode(payments, Payment.PaymentMode.CHEQUE);
        BigDecimal totalNeft = sumByModes(payments, Payment.PaymentMode.NEFT, Payment.PaymentMode.RTGS);
        BigDecimal totalCollected = payments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Opening cash: physicalCashEntered from most recent previous closure
        BigDecimal openingCash = getPreviousClosingCash(tenantId, today);

        BigDecimal expectedCashClosing = openingCash.add(totalCash);

        // Build collector summaries grouped by collector
        List<DayClosureDtos.CollectorSummary> collectors = buildCollectorSummaries(payments);

        DayClosureDtos.DayClosureResponse existingClosure = existingOpt.map(this::toResponse).orElse(null);

        return DayClosureDtos.TodayCounterResponse.builder()
                .closureDate(today)
                .openingCash(openingCash)
                .totalCash(totalCash)
                .totalUpi(totalUpi)
                .totalCheque(totalCheque)
                .totalNeft(totalNeft)
                .totalCollected(totalCollected)
                .expectedCashClosing(expectedCashClosing)
                .alreadyClosed(existingOpt.isPresent())
                .existingClosure(existingClosure)
                .collectors(collectors)
                .build();
    }

    // ─── 2. Close Day ─────────────────────────────────────────────────────────

    @Transactional
    public DayClosureDtos.DayClosureResponse closeDay(UUID tenantId, DayClosureDtos.CloseDayRequest req,
                                                       String closedByName) {
        LocalDate today = LocalDate.now();

        // Guard: prevent double-closure
        if (dayClosureRepository.findByTenantIdAndClosureDate(tenantId, today).isPresent()) {
            throw new BusinessException("Day is already closed for " + today, "DAY_ALREADY_CLOSED");
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        // Recompute totals from live payment data
        List<Payment> payments = paymentRepository.findByTenantIdAndCollectionDate(tenantId, today);

        BigDecimal totalCash = sumByMode(payments, Payment.PaymentMode.CASH);
        BigDecimal totalUpi = sumByMode(payments, Payment.PaymentMode.UPI);
        BigDecimal totalCheque = sumByMode(payments, Payment.PaymentMode.CHEQUE);
        BigDecimal totalNeft = sumByModes(payments, Payment.PaymentMode.NEFT, Payment.PaymentMode.RTGS);
        BigDecimal totalCollected = payments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal openingCash = getPreviousClosingCash(tenantId, today);
        BigDecimal expectedCashClosing = openingCash.add(totalCash);
        BigDecimal difference = req.getPhysicalCashEntered().subtract(expectedCashClosing);

        DayClosure closure = DayClosure.builder()
                .tenant(tenant)
                .closureDate(today)
                .openingCash(openingCash)
                .totalCash(totalCash)
                .totalUpi(totalUpi)
                .totalCheque(totalCheque)
                .totalNeft(totalNeft)
                .totalCollected(totalCollected)
                .expectedCashClosing(expectedCashClosing)
                .physicalCashEntered(req.getPhysicalCashEntered())
                .difference(difference)
                .status(DayClosure.Status.CLOSED)
                .notes(req.getNotes())
                .closedBy(closedByName)
                .closedAt(Instant.now())
                .build();

        DayClosure saved = dayClosureRepository.save(closure);
        return toResponse(saved);
    }

    // ─── 3. Get History ───────────────────────────────────────────────────────

    public List<DayClosureDtos.DayClosureResponse> getHistory(UUID tenantId) {
        return dayClosureRepository.findByTenantIdOrderByClosureDateDesc(tenantId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private BigDecimal sumByMode(List<Payment> payments, Payment.PaymentMode mode) {
        return payments.stream()
                .filter(p -> p.getPaymentMode() == mode)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumByModes(List<Payment> payments, Payment.PaymentMode... modes) {
        Set<Payment.PaymentMode> modeSet = new HashSet<>(Arrays.asList(modes));
        return payments.stream()
                .filter(p -> modeSet.contains(p.getPaymentMode()))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Returns the physicalCashEntered from the most recent closure strictly before today.
     * Falls back to ZERO if no previous closure exists.
     */
    private BigDecimal getPreviousClosingCash(UUID tenantId, LocalDate today) {
        return dayClosureRepository.findByTenantIdOrderByClosureDateDesc(tenantId)
                .stream()
                .filter(c -> c.getClosureDate().isBefore(today))
                .findFirst()
                .map(DayClosure::getPhysicalCashEntered)
                .orElse(BigDecimal.ZERO);
    }

    private List<DayClosureDtos.CollectorSummary> buildCollectorSummaries(List<Payment> payments) {
        // Group by collector user ID
        Map<UUID, List<Payment>> byCollector = payments.stream()
                .collect(Collectors.groupingBy(p -> p.getCollectedBy().getId()));

        List<DayClosureDtos.CollectorSummary> summaries = new ArrayList<>();

        byCollector.forEach((collectorId, collectorPayments) -> {
            User collector = collectorPayments.get(0).getCollectedBy();

            BigDecimal cash = sumByMode(collectorPayments, Payment.PaymentMode.CASH);
            BigDecimal upi = sumByMode(collectorPayments, Payment.PaymentMode.UPI);
            BigDecimal cheque = sumByMode(collectorPayments, Payment.PaymentMode.CHEQUE);
            BigDecimal neft = sumByModes(collectorPayments, Payment.PaymentMode.NEFT, Payment.PaymentMode.RTGS);
            BigDecimal total = collectorPayments.stream()
                    .map(Payment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            long submittedCount = collectorPayments.stream().filter(Payment::isSubmitted).count();

            summaries.add(DayClosureDtos.CollectorSummary.builder()
                    .collectorName(collector.getFullName())
                    .role(collector.getRole() != null ? collector.getRole().name() : null)
                    .cashAmount(cash)
                    .upiAmount(upi)
                    .chequeAmount(cheque)
                    .neftAmount(neft)
                    .totalAmount(total)
                    .submittedCount((int) submittedCount)
                    .totalCount(collectorPayments.size())
                    .build());
        });

        return summaries;
    }

    private DayClosureDtos.DayClosureResponse toResponse(DayClosure c) {
        return DayClosureDtos.DayClosureResponse.builder()
                .id(c.getId())
                .closureDate(c.getClosureDate())
                .openingCash(c.getOpeningCash())
                .totalCash(c.getTotalCash())
                .totalUpi(c.getTotalUpi())
                .totalCheque(c.getTotalCheque())
                .totalNeft(c.getTotalNeft())
                .totalCollected(c.getTotalCollected())
                .expectedCashClosing(c.getExpectedCashClosing())
                .physicalCashEntered(c.getPhysicalCashEntered())
                .difference(c.getDifference())
                .status(c.getStatus() != null ? c.getStatus().name() : null)
                .notes(c.getNotes())
                .closedBy(c.getClosedBy())
                .closedAt(c.getClosedAt())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
