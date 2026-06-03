package com.stockez.api.module.incentive.service;

import com.stockez.api.module.incentive.dto.IncentiveDtos;
import com.stockez.api.module.incentive.entity.BrandTarget;
import com.stockez.api.module.incentive.entity.CollectionIncentiveCredit;
import com.stockez.api.module.incentive.entity.CollectionIncentiveSlab;
import com.stockez.api.module.incentive.entity.CollectionTarget;
import com.stockez.api.module.incentive.entity.IncentiveCredit;
import com.stockez.api.module.incentive.entity.IncentiveSlab;
import com.stockez.api.module.incentive.repository.BrandTargetRepository;
import com.stockez.api.module.incentive.repository.CollectionIncentiveCreditRepository;
import com.stockez.api.module.incentive.repository.CollectionIncentiveSlabRepository;
import com.stockez.api.module.incentive.repository.CollectionTargetRepository;
import com.stockez.api.module.incentive.repository.IncentiveCreditRepository;
import com.stockez.api.module.incentive.repository.IncentiveSlabRepository;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.product.repository.ProductRepository;
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
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class IncentiveService {

    private final BrandTargetRepository targetRepository;
    private final IncentiveSlabRepository slabRepository;
    private final IncentiveCreditRepository creditRepository;
    private final CollectionTargetRepository collectionTargetRepository;
    private final CollectionIncentiveSlabRepository collectionSlabRepository;
    private final CollectionIncentiveCreditRepository collectionCreditRepository;
    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final ProductRepository productRepository;

    private static final List<Order.OrderStatus> ACTIVE_STATUSES = List.of(
        Order.OrderStatus.APPROVED, Order.OrderStatus.PREPARING,
        Order.OrderStatus.PREPARED, Order.OrderStatus.DISPATCHED, Order.OrderStatus.DELIVERED
    );

    // ── Targets ──────────────────────────────────────────────────────────────

    public IncentiveDtos.BrandTargetRow saveTarget(IncentiveDtos.SaveTargetRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User salesPerson = userRepository.findByIdAndTenantId(req.getSalesPersonId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", req.getSalesPersonId().toString()));

        BrandTarget target = targetRepository
                .findByTenantIdAndSalesPersonIdAndBrandAndTargetMonthAndTargetYear(
                        tenantId, req.getSalesPersonId(), req.getBrand(), req.getTargetMonth(), req.getTargetYear())
                .orElseGet(() -> BrandTarget.builder().tenant(tenant).salesPerson(salesPerson).build());

        target.setBrand(req.getBrand());
        target.setTargetMonth(req.getTargetMonth());
        target.setTargetYear(req.getTargetYear());
        target.setTargetValue(req.getTargetValue());

        BrandTarget saved = targetRepository.save(target);
        BigDecimal achieved = computeAchieved(tenantId, salesPerson.getId(), req.getBrand(), req.getTargetMonth(), req.getTargetYear());
        return toTargetRow(saved, achieved, tenantId);
    }

    @Transactional(readOnly = true)
    public IncentiveDtos.TargetSummary getTargetsSummary(UUID tenantId, int month, int year, UUID salesPersonId) {
        List<BrandTarget> targets = salesPersonId != null
                ? targetRepository.findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(tenantId, salesPersonId, month, year)
                : targetRepository.findByTenantIdAndTargetMonthAndTargetYear(tenantId, month, year);

        List<IncentiveDtos.BrandTargetRow> rows = targets.stream().map(t -> {
            BigDecimal achieved = computeAchieved(tenantId, t.getSalesPerson().getId(), t.getBrand(), month, year);
            return toTargetRow(t, achieved, tenantId);
        }).sorted(Comparator.comparing(IncentiveDtos.BrandTargetRow::getSalesPersonName)
                .thenComparing(IncentiveDtos.BrandTargetRow::getBrand))
          .collect(Collectors.toList());

        BigDecimal totalTarget   = rows.stream().map(IncentiveDtos.BrandTargetRow::getTargetValue).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalAchieved = rows.stream().map(IncentiveDtos.BrandTargetRow::getAchievedValue).reduce(BigDecimal.ZERO, BigDecimal::add);

        IncentiveDtos.TargetSummary summary = new IncentiveDtos.TargetSummary();
        summary.setMonth(month);
        summary.setYear(year);
        summary.setTargets(rows);
        summary.setTotalTarget(totalTarget);
        summary.setTotalAchieved(totalAchieved);
        return summary;
    }

    @Transactional(readOnly = true)
    public List<String> getDistinctBrands(UUID tenantId) {
        return productRepository.findDistinctBrands(tenantId);
    }

    // ── Slabs ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<IncentiveDtos.BrandSlabSummary> getAllSlabs(UUID tenantId) {
        List<IncentiveSlab> slabs = slabRepository.findByTenantIdOrderByBrandAscFromPctAsc(tenantId);
        return slabs.stream()
                .collect(Collectors.groupingBy(IncentiveSlab::getBrand))
                .entrySet().stream()
                .sorted(java.util.Map.Entry.comparingByKey())
                .map(e -> {
                    IncentiveDtos.BrandSlabSummary s = new IncentiveDtos.BrandSlabSummary();
                    s.setBrand(e.getKey());
                    s.setSlabs(e.getValue().stream().map(this::toSlabResponse).collect(Collectors.toList()));
                    return s;
                }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<IncentiveDtos.IncentiveSlabResponse> getSlabsForBrand(UUID tenantId, String brand) {
        return slabRepository.findByTenantIdAndBrandOrderByFromPctAsc(tenantId, brand)
                .stream().map(this::toSlabResponse).collect(Collectors.toList());
    }

    public List<IncentiveDtos.IncentiveSlabResponse> saveSlabs(IncentiveDtos.SaveSlabsRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        slabRepository.deleteByTenantIdAndBrand(tenantId, req.getBrand());

        List<IncentiveSlab> slabs = req.getSlabs().stream().map(s -> IncentiveSlab.builder()
                .tenant(tenant)
                .brand(req.getBrand())
                .fromPct(s.getFromPct())
                .toPct(s.getToPct())
                .incentiveAmount(s.getIncentiveAmount())
                .build()
        ).collect(Collectors.toList());

        return slabRepository.saveAll(slabs).stream()
                .sorted(Comparator.comparingInt(IncentiveSlab::getFromPct))
                .map(this::toSlabResponse)
                .collect(Collectors.toList());
    }

    // ── Credits ───────────────────────────────────────────────────────────────

    public IncentiveDtos.CreditSummary calculateAndCredit(IncentiveDtos.CreditRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        List<BrandTarget> targets = targetRepository.findByTenantIdAndTargetMonthAndTargetYear(
                tenantId, req.getTargetMonth(), req.getTargetYear());

        for (BrandTarget t : targets) {
            BigDecimal achieved = computeAchieved(tenantId, t.getSalesPerson().getId(), t.getBrand(), req.getTargetMonth(), req.getTargetYear());
            BigDecimal pct = t.getTargetValue().compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.ZERO
                    : achieved.multiply(BigDecimal.valueOf(100)).divide(t.getTargetValue(), 2, RoundingMode.HALF_UP);

            List<IncentiveSlab> slabs = slabRepository.findByTenantIdAndBrandOrderByFromPctAsc(tenantId, t.getBrand());
            IncentiveSlab matched = findMatchingSlab(slabs, pct);
            BigDecimal incentiveAmount = matched != null ? matched.getIncentiveAmount() : BigDecimal.ZERO;

            IncentiveCredit credit = creditRepository
                    .findByTenantIdAndSalesPersonIdAndBrandAndTargetMonthAndTargetYear(
                            tenantId, t.getSalesPerson().getId(), t.getBrand(), req.getTargetMonth(), req.getTargetYear())
                    .orElseGet(() -> IncentiveCredit.builder().tenant(tenant).salesPerson(t.getSalesPerson()).build());

            credit.setBrand(t.getBrand());
            credit.setTargetMonth(req.getTargetMonth());
            credit.setTargetYear(req.getTargetYear());
            credit.setTargetValue(t.getTargetValue());
            credit.setAchievedValue(achieved);
            credit.setAchievementPct(pct);
            credit.setIncentiveAmount(incentiveAmount);
            if ("PENDING".equals(credit.getStatus()) || credit.getStatus() == null) {
                credit.setStatus("PENDING");
            }
            creditRepository.save(credit);
        }

        return getCreditSummary(tenantId, req.getTargetMonth(), req.getTargetYear());
    }

    public IncentiveDtos.IncentiveCreditResponse markCredited(UUID creditId, UUID tenantId) {
        IncentiveCredit credit = creditRepository.findById(creditId)
                .orElseThrow(() -> new ResourceNotFoundException("IncentiveCredit", creditId.toString()));
        credit.setStatus("CREDITED");
        credit.setCreditedAt(Instant.now());
        return toCreditResponse(creditRepository.save(credit));
    }

    @Transactional(readOnly = true)
    public IncentiveDtos.CreditSummary getCreditSummary(UUID tenantId, int month, int year) {
        List<IncentiveCredit> credits = creditRepository
                .findByTenantIdAndTargetMonthAndTargetYearOrderBySalesPersonFullNameAscBrandAsc(tenantId, month, year);

        BigDecimal total = credits.stream().map(IncentiveCredit::getIncentiveAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long pending   = credits.stream().filter(c -> "PENDING".equals(c.getStatus())).count();
        long credited  = credits.stream().filter(c -> "CREDITED".equals(c.getStatus())).count();

        IncentiveDtos.CreditSummary summary = new IncentiveDtos.CreditSummary();
        summary.setMonth(month);
        summary.setYear(year);
        summary.setCredits(credits.stream().map(this::toCreditResponse).collect(Collectors.toList()));
        summary.setTotalIncentive(total);
        summary.setTotalPending(pending);
        summary.setTotalCredited(credited);
        return summary;
    }

    // ── Employee view ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public IncentiveDtos.MyIncentiveView getMyIncentives(UUID tenantId, UUID userId, int month, int year) {
        List<BrandTarget> targets = targetRepository.findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(
                tenantId, userId, month, year);

        List<IncentiveDtos.BrandIncentiveCard> cards = targets.stream().map(t -> {
            BigDecimal achieved = computeAchieved(tenantId, userId, t.getBrand(), month, year);
            BigDecimal pct = t.getTargetValue().compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.ZERO
                    : achieved.multiply(BigDecimal.valueOf(100)).divide(t.getTargetValue(), 2, RoundingMode.HALF_UP);

            List<IncentiveSlab> slabs = slabRepository.findByTenantIdAndBrandOrderByFromPctAsc(tenantId, t.getBrand());
            IncentiveSlab matched  = findMatchingSlab(slabs, pct);
            IncentiveSlab nextSlab = findNextSlab(slabs, matched);

            BigDecimal earned = matched != null ? matched.getIncentiveAmount() : BigDecimal.ZERO;
            BigDecimal nextTierIncentive = null;
            BigDecimal gapToNext = null;
            BigDecimal nextTierPct = null;

            if (nextSlab != null) {
                nextTierPct      = BigDecimal.valueOf(nextSlab.getFromPct());
                nextTierIncentive = nextSlab.getIncentiveAmount();
                BigDecimal neededValue = t.getTargetValue()
                        .multiply(nextTierPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                gapToNext = neededValue.subtract(achieved).max(BigDecimal.ZERO);
            }

            boolean credited = creditRepository
                    .findByTenantIdAndSalesPersonIdAndBrandAndTargetMonthAndTargetYear(tenantId, userId, t.getBrand(), month, year)
                    .map(c -> "CREDITED".equals(c.getStatus()))
                    .orElse(false);

            IncentiveDtos.BrandIncentiveCard card = new IncentiveDtos.BrandIncentiveCard();
            card.setBrand(t.getBrand());
            card.setTargetValue(t.getTargetValue());
            card.setAchievedValue(achieved);
            card.setAchievementPct(pct);
            card.setAchievementStatus(achievementStatus(pct));
            card.setEarnedIncentive(earned);
            card.setNextTierIncentive(nextTierIncentive);
            card.setGapToNextTier(gapToNext);
            card.setNextTierTargetPct(nextTierPct);
            card.setSlabs(slabs.stream().map(this::toSlabResponse).collect(Collectors.toList()));
            card.setCredited(credited);
            return card;
        }).sorted(Comparator.comparing(IncentiveDtos.BrandIncentiveCard::getAchievementPct).reversed())
          .collect(Collectors.toList());

        // Collection card
        IncentiveDtos.CollectionIncentiveCard collectionCard = null;
        List<CollectionTarget> collectionTargets = collectionTargetRepository
                .findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(tenantId, userId, month, year);
        if (!collectionTargets.isEmpty()) {
            CollectionTarget ct = collectionTargets.get(0);
            BigDecimal collAchieved = computeCollectionAchieved(tenantId, userId, month, year);
            BigDecimal collPct = ct.getTargetValue().compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.ZERO
                    : collAchieved.multiply(BigDecimal.valueOf(100)).divide(ct.getTargetValue(), 2, RoundingMode.HALF_UP);
            List<CollectionIncentiveSlab> collSlabs = collectionSlabRepository.findByTenantIdOrderByFromPctAsc(tenantId);
            CollectionIncentiveSlab collMatched = findMatchingCollectionSlab(collSlabs, collPct);
            CollectionIncentiveSlab collNext = findNextCollectionSlab(collSlabs, collMatched);

            BigDecimal collEarned = collMatched != null ? collMatched.getIncentiveAmount() : BigDecimal.ZERO;
            BigDecimal collNextIncentive = null;
            BigDecimal collGapToNext = null;
            BigDecimal collNextPct = null;
            if (collNext != null) {
                collNextPct = BigDecimal.valueOf(collNext.getFromPct());
                collNextIncentive = collNext.getIncentiveAmount();
                BigDecimal needed = ct.getTargetValue().multiply(collNextPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                collGapToNext = needed.subtract(collAchieved).max(BigDecimal.ZERO);
            }
            boolean collCredited = collectionCreditRepository
                    .findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(tenantId, userId, month, year)
                    .map(c -> "CREDITED".equals(c.getStatus())).orElse(false);

            collectionCard = new IncentiveDtos.CollectionIncentiveCard();
            collectionCard.setTargetValue(ct.getTargetValue());
            collectionCard.setAchievedValue(collAchieved);
            collectionCard.setAchievementPct(collPct);
            collectionCard.setAchievementStatus(achievementStatus(collPct));
            collectionCard.setEarnedIncentive(collEarned);
            collectionCard.setNextTierIncentive(collNextIncentive);
            collectionCard.setGapToNextTier(collGapToNext);
            collectionCard.setNextTierTargetPct(collNextPct);
            collectionCard.setSlabs(collSlabs.stream().map(this::toCollectionSlabResponse).collect(Collectors.toList()));
            collectionCard.setCredited(collCredited);
        }

        BigDecimal totalEarned    = cards.stream().map(IncentiveDtos.BrandIncentiveCard::getEarnedIncentive).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (collectionCard != null) totalEarned = totalEarned.add(collectionCard.getEarnedIncentive());

        BigDecimal totalPotential = slabRepository.findByTenantIdOrderByBrandAscFromPctAsc(tenantId)
                .stream().filter(s -> s.getToPct() == null)
                .collect(Collectors.groupingBy(IncentiveSlab::getBrand))
                .values().stream()
                .map(list -> list.stream().max(Comparator.comparingInt(IncentiveSlab::getFromPct)).map(IncentiveSlab::getIncentiveAmount).orElse(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<CollectionIncentiveSlab> topCollSlabs = collectionSlabRepository.findByTenantIdOrderByFromPctAsc(tenantId);
        if (!topCollSlabs.isEmpty()) {
            topCollSlabs.stream().max(Comparator.comparingInt(CollectionIncentiveSlab::getFromPct))
                    .ifPresent(s -> totalPotential.add(s.getIncentiveAmount()));
        }

        IncentiveDtos.MyIncentiveView view = new IncentiveDtos.MyIncentiveView();
        view.setMonth(month);
        view.setYear(year);
        view.setTotalEarned(totalEarned);
        view.setTotalPotential(totalPotential);
        view.setBrands(cards);
        view.setCollectionCard(collectionCard);
        return view;
    }

    // ── Collection Targets ────────────────────────────────────────────────────

    public IncentiveDtos.CollectionTargetRow saveCollectionTarget(IncentiveDtos.SaveCollectionTargetRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User salesPerson = userRepository.findByIdAndTenantId(req.getSalesPersonId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", req.getSalesPersonId().toString()));

        CollectionTarget target = collectionTargetRepository
                .findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(
                        tenantId, req.getSalesPersonId(), req.getTargetMonth(), req.getTargetYear())
                .stream().findFirst()
                .orElseGet(() -> CollectionTarget.builder().tenant(tenant).salesPerson(salesPerson).build());

        target.setTargetMonth(req.getTargetMonth());
        target.setTargetYear(req.getTargetYear());
        target.setTargetValue(req.getTargetValue());

        CollectionTarget saved = collectionTargetRepository.save(target);
        BigDecimal achieved = computeCollectionAchieved(tenantId, salesPerson.getId(), req.getTargetMonth(), req.getTargetYear());
        return toCollectionTargetRow(saved, achieved, tenantId);
    }

    @Transactional(readOnly = true)
    public IncentiveDtos.CollectionTargetSummary getCollectionTargetsSummary(UUID tenantId, int month, int year, UUID salesPersonId) {
        List<CollectionTarget> targets = salesPersonId != null
                ? collectionTargetRepository.findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(tenantId, salesPersonId, month, year)
                : collectionTargetRepository.findByTenantIdAndTargetMonthAndTargetYear(tenantId, month, year);

        List<IncentiveDtos.CollectionTargetRow> rows = targets.stream()
                .map(t -> {
                    BigDecimal achieved = computeCollectionAchieved(tenantId, t.getSalesPerson().getId(), month, year);
                    return toCollectionTargetRow(t, achieved, tenantId);
                })
                .sorted(Comparator.comparing(IncentiveDtos.CollectionTargetRow::getSalesPersonName))
                .collect(Collectors.toList());

        IncentiveDtos.CollectionTargetSummary summary = new IncentiveDtos.CollectionTargetSummary();
        summary.setMonth(month);
        summary.setYear(year);
        summary.setTargets(rows);
        summary.setTotalTarget(rows.stream().map(IncentiveDtos.CollectionTargetRow::getTargetValue).reduce(BigDecimal.ZERO, BigDecimal::add));
        summary.setTotalAchieved(rows.stream().map(IncentiveDtos.CollectionTargetRow::getAchievedValue).reduce(BigDecimal.ZERO, BigDecimal::add));
        return summary;
    }

    // ── Collection Slabs ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<IncentiveDtos.CollectionSlabResponse> getCollectionSlabs(UUID tenantId) {
        return collectionSlabRepository.findByTenantIdOrderByFromPctAsc(tenantId)
                .stream().map(this::toCollectionSlabResponse).collect(Collectors.toList());
    }

    public List<IncentiveDtos.CollectionSlabResponse> saveCollectionSlabs(IncentiveDtos.SaveCollectionSlabsRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        collectionSlabRepository.deleteByTenantId(tenantId);

        List<CollectionIncentiveSlab> slabs = req.getSlabs().stream().map(s -> CollectionIncentiveSlab.builder()
                .tenant(tenant)
                .fromPct(s.getFromPct())
                .toPct(s.getToPct())
                .incentiveAmount(s.getIncentiveAmount())
                .build()
        ).collect(Collectors.toList());

        return collectionSlabRepository.saveAll(slabs).stream()
                .sorted(Comparator.comparingInt(CollectionIncentiveSlab::getFromPct))
                .map(this::toCollectionSlabResponse)
                .collect(Collectors.toList());
    }

    // ── Collection Credits ────────────────────────────────────────────────────

    public IncentiveDtos.CollectionCreditSummary calculateAndCreditCollections(IncentiveDtos.CreditRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        List<CollectionTarget> targets = collectionTargetRepository
                .findByTenantIdAndTargetMonthAndTargetYear(tenantId, req.getTargetMonth(), req.getTargetYear());
        List<CollectionIncentiveSlab> slabs = collectionSlabRepository.findByTenantIdOrderByFromPctAsc(tenantId);

        for (CollectionTarget t : targets) {
            BigDecimal achieved = computeCollectionAchieved(tenantId, t.getSalesPerson().getId(), req.getTargetMonth(), req.getTargetYear());
            BigDecimal pct = t.getTargetValue().compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.ZERO
                    : achieved.multiply(BigDecimal.valueOf(100)).divide(t.getTargetValue(), 2, RoundingMode.HALF_UP);

            CollectionIncentiveSlab matched = findMatchingCollectionSlab(slabs, pct);
            BigDecimal incentiveAmount = matched != null ? matched.getIncentiveAmount() : BigDecimal.ZERO;

            CollectionIncentiveCredit credit = collectionCreditRepository
                    .findByTenantIdAndSalesPersonIdAndTargetMonthAndTargetYear(
                            tenantId, t.getSalesPerson().getId(), req.getTargetMonth(), req.getTargetYear())
                    .orElseGet(() -> CollectionIncentiveCredit.builder().tenant(tenant).salesPerson(t.getSalesPerson()).build());

            credit.setTargetMonth(req.getTargetMonth());
            credit.setTargetYear(req.getTargetYear());
            credit.setTargetValue(t.getTargetValue());
            credit.setAchievedValue(achieved);
            credit.setAchievementPct(pct);
            credit.setIncentiveAmount(incentiveAmount);
            if (credit.getStatus() == null) credit.setStatus("PENDING");
            collectionCreditRepository.save(credit);
        }

        return getCollectionCreditSummary(tenantId, req.getTargetMonth(), req.getTargetYear());
    }

    @Transactional(readOnly = true)
    public IncentiveDtos.CollectionCreditSummary getCollectionCreditSummary(UUID tenantId, int month, int year) {
        List<CollectionIncentiveCredit> credits = collectionCreditRepository
                .findByTenantIdAndTargetMonthAndTargetYearOrderBySalesPersonFullNameAsc(tenantId, month, year);

        IncentiveDtos.CollectionCreditSummary summary = new IncentiveDtos.CollectionCreditSummary();
        summary.setMonth(month);
        summary.setYear(year);
        summary.setCredits(credits.stream().map(this::toCollectionCreditResponse).collect(Collectors.toList()));
        summary.setTotalIncentive(credits.stream().map(CollectionIncentiveCredit::getIncentiveAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
        summary.setTotalPending(credits.stream().filter(c -> "PENDING".equals(c.getStatus())).count());
        summary.setTotalCredited(credits.stream().filter(c -> "CREDITED".equals(c.getStatus())).count());
        return summary;
    }

    public IncentiveDtos.CollectionCreditResponse markCollectionCredited(UUID creditId, UUID tenantId) {
        CollectionIncentiveCredit credit = collectionCreditRepository.findById(creditId)
                .orElseThrow(() -> new ResourceNotFoundException("CollectionIncentiveCredit", creditId.toString()));
        credit.setStatus("CREDITED");
        credit.setCreditedAt(Instant.now());
        return toCollectionCreditResponse(collectionCreditRepository.save(credit));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private BigDecimal computeAchieved(UUID tenantId, UUID salesPersonId, String brand, int month, int year) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate from = ym.atDay(1);
        LocalDate to   = ym.atEndOfMonth();
        return orderRepository.sumBrandSalesByPerson(tenantId, salesPersonId, brand, from, to, ACTIVE_STATUSES);
    }

    private BigDecimal computeCollectionAchieved(UUID tenantId, UUID salesPersonId, int month, int year) {
        YearMonth ym = YearMonth.of(year, month);
        return paymentRepository.sumCollectionsByPerson(tenantId, salesPersonId, ym.atDay(1), ym.atEndOfMonth());
    }

    private CollectionIncentiveSlab findMatchingCollectionSlab(List<CollectionIncentiveSlab> slabs, BigDecimal pct) {
        return slabs.stream()
                .filter(s -> pct.compareTo(BigDecimal.valueOf(s.getFromPct())) >= 0
                          && (s.getToPct() == null || pct.compareTo(BigDecimal.valueOf(s.getToPct())) <= 0))
                .max(Comparator.comparingInt(CollectionIncentiveSlab::getFromPct))
                .orElse(null);
    }

    private CollectionIncentiveSlab findNextCollectionSlab(List<CollectionIncentiveSlab> slabs, CollectionIncentiveSlab current) {
        int baseline = current != null ? current.getFromPct() : -1;
        return slabs.stream()
                .filter(s -> s.getFromPct() > baseline)
                .min(Comparator.comparingInt(CollectionIncentiveSlab::getFromPct))
                .orElse(null);
    }

    private IncentiveDtos.CollectionTargetRow toCollectionTargetRow(CollectionTarget t, BigDecimal achieved, UUID tenantId) {
        BigDecimal pct = t.getTargetValue().compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : achieved.multiply(BigDecimal.valueOf(100)).divide(t.getTargetValue(), 2, RoundingMode.HALF_UP);

        List<CollectionIncentiveSlab> slabs = collectionSlabRepository.findByTenantIdOrderByFromPctAsc(tenantId);
        CollectionIncentiveSlab matched = findMatchingCollectionSlab(slabs, pct);

        IncentiveDtos.CollectionTargetRow row = new IncentiveDtos.CollectionTargetRow();
        row.setId(t.getId());
        row.setSalesPersonId(t.getSalesPerson().getId());
        row.setSalesPersonName(t.getSalesPerson().getFullName());
        row.setSalesPersonPhone(t.getSalesPerson().getPhone());
        row.setTargetMonth(t.getTargetMonth());
        row.setTargetYear(t.getTargetYear());
        row.setTargetValue(t.getTargetValue());
        row.setAchievedValue(achieved);
        row.setAchievementPct(pct);
        row.setEarnedIncentive(matched != null ? matched.getIncentiveAmount() : BigDecimal.ZERO);
        row.setAchievementStatus(achievementStatus(pct));
        return row;
    }

    private IncentiveDtos.CollectionSlabResponse toCollectionSlabResponse(CollectionIncentiveSlab s) {
        IncentiveDtos.CollectionSlabResponse r = new IncentiveDtos.CollectionSlabResponse();
        r.setId(s.getId());
        r.setFromPct(s.getFromPct());
        r.setToPct(s.getToPct());
        r.setIncentiveAmount(s.getIncentiveAmount());
        return r;
    }

    private IncentiveDtos.CollectionCreditResponse toCollectionCreditResponse(CollectionIncentiveCredit c) {
        IncentiveDtos.CollectionCreditResponse r = new IncentiveDtos.CollectionCreditResponse();
        r.setId(c.getId());
        r.setSalesPersonId(c.getSalesPerson().getId());
        r.setSalesPersonName(c.getSalesPerson().getFullName());
        r.setSalesPersonPhone(c.getSalesPerson().getPhone());
        r.setTargetMonth(c.getTargetMonth());
        r.setTargetYear(c.getTargetYear());
        r.setTargetValue(c.getTargetValue());
        r.setAchievedValue(c.getAchievedValue());
        r.setAchievementPct(c.getAchievementPct());
        r.setIncentiveAmount(c.getIncentiveAmount());
        r.setStatus(c.getStatus());
        r.setCreditedAt(c.getCreditedAt());
        r.setNotes(c.getNotes());
        return r;
    }

    private IncentiveSlab findMatchingSlab(List<IncentiveSlab> slabs, BigDecimal pct) {
        return slabs.stream()
                .filter(s -> pct.compareTo(BigDecimal.valueOf(s.getFromPct())) >= 0
                          && (s.getToPct() == null || pct.compareTo(BigDecimal.valueOf(s.getToPct())) <= 0))
                .max(Comparator.comparingInt(IncentiveSlab::getFromPct))
                .orElse(null);
    }

    private IncentiveSlab findNextSlab(List<IncentiveSlab> slabs, IncentiveSlab current) {
        int baseline = current != null ? current.getFromPct() : -1;
        return slabs.stream()
                .filter(s -> s.getFromPct() > baseline)
                .min(Comparator.comparingInt(IncentiveSlab::getFromPct))
                .orElse(null);
    }

    private String achievementStatus(BigDecimal pct) {
        double p = pct.doubleValue();
        if (p >= 100) return "ACHIEVED";
        if (p >= 80)  return "NEAR_TARGET";
        if (p >= 50)  return "NEEDS_ATTENTION";
        return "AT_RISK";
    }

    private IncentiveDtos.BrandTargetRow toTargetRow(BrandTarget t, BigDecimal achieved, UUID tenantId) {
        BigDecimal pct = t.getTargetValue().compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : achieved.multiply(BigDecimal.valueOf(100)).divide(t.getTargetValue(), 2, RoundingMode.HALF_UP);

        List<IncentiveSlab> slabs = slabRepository.findByTenantIdAndBrandOrderByFromPctAsc(tenantId, t.getBrand());
        IncentiveSlab matched = findMatchingSlab(slabs, pct);

        IncentiveDtos.BrandTargetRow row = new IncentiveDtos.BrandTargetRow();
        row.setId(t.getId());
        row.setSalesPersonId(t.getSalesPerson().getId());
        row.setSalesPersonName(t.getSalesPerson().getFullName());
        row.setSalesPersonPhone(t.getSalesPerson().getPhone());
        row.setBrand(t.getBrand());
        row.setTargetMonth(t.getTargetMonth());
        row.setTargetYear(t.getTargetYear());
        row.setTargetValue(t.getTargetValue());
        row.setAchievedValue(achieved);
        row.setAchievementPct(pct);
        row.setEarnedIncentive(matched != null ? matched.getIncentiveAmount() : BigDecimal.ZERO);
        row.setAchievementStatus(achievementStatus(pct));
        return row;
    }

    private IncentiveDtos.IncentiveSlabResponse toSlabResponse(IncentiveSlab s) {
        IncentiveDtos.IncentiveSlabResponse r = new IncentiveDtos.IncentiveSlabResponse();
        r.setId(s.getId());
        r.setBrand(s.getBrand());
        r.setFromPct(s.getFromPct());
        r.setToPct(s.getToPct());
        r.setIncentiveAmount(s.getIncentiveAmount());
        return r;
    }

    private IncentiveDtos.IncentiveCreditResponse toCreditResponse(IncentiveCredit c) {
        IncentiveDtos.IncentiveCreditResponse r = new IncentiveDtos.IncentiveCreditResponse();
        r.setId(c.getId());
        r.setSalesPersonId(c.getSalesPerson().getId());
        r.setSalesPersonName(c.getSalesPerson().getFullName());
        r.setSalesPersonPhone(c.getSalesPerson().getPhone());
        r.setBrand(c.getBrand());
        r.setTargetMonth(c.getTargetMonth());
        r.setTargetYear(c.getTargetYear());
        r.setTargetValue(c.getTargetValue());
        r.setAchievedValue(c.getAchievedValue());
        r.setAchievementPct(c.getAchievementPct());
        r.setIncentiveAmount(c.getIncentiveAmount());
        r.setStatus(c.getStatus());
        r.setCreditedAt(c.getCreditedAt());
        r.setNotes(c.getNotes());
        return r;
    }
}
