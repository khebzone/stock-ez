package com.stockez.api.module.purchase.service;

import com.stockez.api.module.audit.entity.AuditLog;
import com.stockez.api.module.audit.repository.AuditLogRepository;
import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.dto.PurchaseDtos;
import com.stockez.api.module.supplier.entity.Supplier;
import com.stockez.api.module.supplier.repository.SupplierRepository;
import com.stockez.api.module.purchase.entity.PurchaseEntry;
import com.stockez.api.module.purchase.entity.PurchaseItem;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.repository.PurchaseDraftRepository;
import com.stockez.api.module.purchase.repository.PurchaseEntryRepository;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stockez.common.exception.BusinessException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class PurchaseService {

    private final PurchaseEntryRepository purchaseEntryRepository;
    private final StockBatchRepository stockBatchRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final SupplierRepository supplierRepository;
    private final AuditLogRepository auditLogRepository;
    private final PurchaseDraftRepository purchaseDraftRepository;

    private static final RoundingMode HU = RoundingMode.HALF_UP;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    // A batch keeps a link to the line that created it; when that line is deleted the batch moves to
    // another bill that feeds it (a merged batch), or is left unlinked.
    private void detachBatchFromItem(StockBatch batch, PurchaseItem item) {
        if (batch.getPurchaseItem() == null || item.getId() == null
                || !item.getId().equals(batch.getPurchaseItem().getId())) return;
        List<PurchaseItem> others = purchaseEntryRepository.findOtherItemsInBatch(
                batch.getTenant().getId(), batch.getBatchNumber(), item.getId());
        batch.setPurchaseItem(others.isEmpty() ? null : others.get(0));
    }

    private static BigDecimal zeroIfNull(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static BigDecimal sum(List<BigDecimal> values) {
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static int units(PurchaseDtos.PurchaseItemRequest r) {
        return (r.getQuantity() != null ? r.getQuantity() : 0) + (r.getFreeQty() != null ? r.getFreeQty() : 0);
    }

    /** Paid qty and bill amount go together; a line with no paid qty is free goods at ₹0. */
    private void validateUnits(PurchaseDtos.PurchaseItemRequest r, String productName) {
        int qty = r.getQuantity() != null ? r.getQuantity() : 0;
        if (units(r) <= 0) {
            throw new BusinessException("Enter a quantity for '" + productName + "'", "QTY_REQUIRED");
        }
        if (qty == 0 && r.getTotalAmount().signum() > 0) {
            throw new BusinessException("'" + productName + "' has no paid quantity — enter it under Qty, "
                    + "or set its amount to 0 if it came free", "FREE_LINE_HAS_AMOUNT");
        }
        if (qty > 0 && r.getTotalAmount().signum() == 0) {
            throw new BusinessException("Enter the bill amount for '" + productName
                    + "', or move its quantity to Free if it came free", "AMOUNT_REQUIRED");
        }
    }

    /** The line's own discount in ₹ — from its % when one is given, else the ₹ entered. */
    private BigDecimal lineDiscount(PurchaseDtos.PurchaseItemRequest r, String productName) {
        BigDecimal gross = r.getTotalAmount().setScale(2, HU);
        BigDecimal disc = r.getDiscountPercent() != null && r.getDiscountPercent().signum() > 0
                ? gross.multiply(r.getDiscountPercent()).divide(HUNDRED, 2, HU)
                : zeroIfNull(r.getDiscountAmount()).setScale(2, HU);
        if (disc.compareTo(gross) > 0) {
            throw new BusinessException("Discount for '" + productName + "' cannot be more than its amount",
                    "DISCOUNT_EXCEEDS_AMOUNT");
        }
        return disc;
    }

    private static boolean differs(BigDecimal asked, BigDecimal current) {
        return asked != null && (current == null || asked.compareTo(current) != 0);
    }

    /** The same sale-rate rules the purchase screen enforces: cost &lt; min ≤ max ≤ MRP. */
    private void validateSaleLimits(String productName, BigDecimal purchRate, BigDecimal min, BigDecimal max, BigDecimal mrp) {
        if (min != null && purchRate != null && purchRate.signum() > 0 && min.compareTo(purchRate) <= 0) {
            throw new BusinessException("Min sale rate ₹" + min.toPlainString() + " for '" + productName
                    + "' must be greater than purchase rate ₹" + purchRate.setScale(2, HU).toPlainString(), "MIN_RATE_BELOW_PURCHASE");
        }
        if (min != null && max != null && min.compareTo(max) > 0) {
            throw new BusinessException("Min sale rate ₹" + min.toPlainString() + " for '" + productName
                    + "' cannot be more than max sale rate ₹" + max.toPlainString(), "MIN_ABOVE_MAX");
        }
        if (max != null && mrp != null && max.compareTo(mrp) > 0) {
            throw new BusinessException("Max sale rate ₹" + max.toPlainString() + " for '" + productName
                    + "' cannot exceed MRP ₹" + mrp.toPlainString(), "MAX_ABOVE_MRP");
        }
    }

    private static String adjustmentType(String type) {
        return "PERCENT".equalsIgnoreCase(type) ? "PERCENT" : "AMOUNT";
    }

    /** A bill-level adjustment in ₹: a % of `base`, or the amount as entered. Never more than `base`. */
    private BigDecimal adjustmentAmount(String type, BigDecimal value, BigDecimal base, String label) {
        if (value == null || value.signum() <= 0) return BigDecimal.ZERO;
        boolean pct = "PERCENT".equals(adjustmentType(type));
        if (pct && value.compareTo(HUNDRED) > 0) {
            throw new BusinessException(label + " cannot be more than 100%", "ADJUSTMENT_EXCEEDS_BILL");
        }
        BigDecimal amount = pct ? base.multiply(value).divide(HUNDRED, 2, HU) : value.setScale(2, HU);
        if (amount.compareTo(base) > 0) {
            throw new BusinessException(label + " ₹" + amount.toPlainString()
                    + " cannot be more than the goods value ₹" + base.toPlainString(), "ADJUSTMENT_EXCEEDS_BILL");
        }
        return amount;
    }

    /** Splits `total` across lines in proportion to `weights`; the rounding paise go to the largest line. */
    private static List<BigDecimal> allocate(BigDecimal total, List<BigDecimal> weights) {
        List<BigDecimal> shares = new ArrayList<>();
        BigDecimal weightSum = sum(weights);
        if (total.signum() == 0 || weightSum.signum() == 0) {
            weights.forEach(w -> shares.add(BigDecimal.ZERO));
            return shares;
        }
        BigDecimal allocated = BigDecimal.ZERO;
        int largest = 0;
        for (int i = 0; i < weights.size(); i++) {
            BigDecimal share = total.multiply(weights.get(i)).divide(weightSum, 2, HU);
            shares.add(share);
            allocated = allocated.add(share);
            if (weights.get(i).compareTo(weights.get(largest)) > 0) largest = i;
        }
        shares.set(largest, shares.get(largest).add(total.subtract(allocated)));
        return shares;
    }

    private static final class BillCalc {
        List<BigDecimal> itemDiscounts = new ArrayList<>();
        List<BigDecimal> billShares;
        List<BigDecimal> freightShares;
        List<LineMath> maths = new ArrayList<>();
        BigDecimal billDiscount;
        BigDecimal freight;
    }

    /**
     * The whole bill, line by line: each line's own discount, the bill discount spread by value
     * (before GST), GST, and freight spread by value into landed cost. Create and edit both go
     * through here so a re-saved bill always lands on the same numbers.
     */
    private BillCalc calculateBill(List<PurchaseDtos.PurchaseItemRequest> reqs, List<Product> products,
                                   List<BigDecimal> gstPcts, PurchaseDtos.CreatePurchaseRequest bill) {
        BillCalc bc = new BillCalc();
        List<BigDecimal> afterItemDiscount = new ArrayList<>();
        List<BigDecimal> unitWeights = new ArrayList<>();
        for (int i = 0; i < reqs.size(); i++) {
            PurchaseDtos.PurchaseItemRequest r = reqs.get(i);
            String name = products.get(i).getName();
            validateUnits(r, name);
            BigDecimal disc = lineDiscount(r, name);
            bc.itemDiscounts.add(disc);
            afterItemDiscount.add(r.getTotalAmount().setScale(2, HU).subtract(disc));
            unitWeights.add(BigDecimal.valueOf(units(r)));
        }
        bc.billDiscount = adjustmentAmount(bill.getBillDiscountType(), bill.getBillDiscountValue(),
                sum(afterItemDiscount), "Bill discount");
        bc.billShares = allocate(bc.billDiscount, afterItemDiscount);
        List<BigDecimal> lineNets = new ArrayList<>();
        for (int i = 0; i < afterItemDiscount.size(); i++) {
            lineNets.add(afterItemDiscount.get(i).subtract(bc.billShares.get(i)));
        }
        bc.freight = zeroIfNull(bill.getFreightAmount()).setScale(2, HU);
        bc.freightShares = allocate(bc.freight, sum(lineNets).signum() > 0 ? lineNets : unitWeights);
        for (int i = 0; i < reqs.size(); i++) {
            bc.maths.add(lineMath(gstPcts.get(i), lineNets.get(i), bc.freightShares.get(i), units(reqs.get(i))));
        }
        return bc;
    }

    /**
     * On an edit, a line with units already sold keeps its bill-discount and freight share per unit,
     * so cutting its quantity leaves its cost as recorded; the unsold lines share what is left.
     * With no unsold line to take the rest, the plain spread stands (and a cost change is refused).
     */
    private void pinSoldLineShares(BillCalc bc, List<PurchaseDtos.PurchaseItemRequest> reqs,
                                   List<PurchaseItem> matched, List<BigDecimal> gstPcts, UUID tenantId) {
        int n = reqs.size();
        boolean[] pinned = new boolean[n];
        boolean anyPinned = false, anyFree = false;
        for (int i = 0; i < n; i++) {
            PurchaseItem old = matched.get(i);
            if (old != null && old.getUnits() > 0) {
                StockBatch batch = stockBatchRepository.findByTenantAndBatchNumber(tenantId, old.getBatchNumber()).orElse(null);
                pinned[i] = batch != null && old.getUnits() - batch.getQuantityAvailable() > 0;
            }
            anyPinned |= pinned[i];
            anyFree |= !pinned[i];
        }
        if (!anyPinned || !anyFree) return;

        List<BigDecimal> billShares = new ArrayList<>(bc.billShares);
        List<BigDecimal> freightShares = new ArrayList<>(bc.freightShares);
        BigDecimal pinnedBill = BigDecimal.ZERO, pinnedFreight = BigDecimal.ZERO;
        for (int i = 0; i < n; i++) {
            if (!pinned[i]) continue;
            PurchaseItem old = matched.get(i);
            BigDecimal ratio = BigDecimal.valueOf(units(reqs.get(i))).divide(BigDecimal.valueOf(old.getUnits()), 10, HU);
            billShares.set(i, zeroIfNull(old.getBillDiscountAmount()).multiply(ratio).setScale(2, HU));
            freightShares.set(i, zeroIfNull(old.getFreightAmount()).multiply(ratio).setScale(2, HU));
            pinnedBill = pinnedBill.add(billShares.get(i));
            pinnedFreight = pinnedFreight.add(freightShares.get(i));
        }
        BigDecimal billLeft = bc.billDiscount.subtract(pinnedBill);
        BigDecimal freightLeft = bc.freight.subtract(pinnedFreight);
        if (billLeft.signum() < 0 || freightLeft.signum() < 0) return;

        List<Integer> free = new ArrayList<>();
        List<BigDecimal> freeAfterDisc = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            if (pinned[i]) continue;
            free.add(i);
            freeAfterDisc.add(reqs.get(i).getTotalAmount().setScale(2, HU).subtract(bc.itemDiscounts.get(i)));
        }
        List<BigDecimal> freeBill = allocate(billLeft, freeAfterDisc);
        List<BigDecimal> freeNets = new ArrayList<>();
        List<BigDecimal> freeUnits = new ArrayList<>();
        for (int k = 0; k < free.size(); k++) {
            billShares.set(free.get(k), freeBill.get(k));
            freeNets.add(freeAfterDisc.get(k).subtract(freeBill.get(k)));
            freeUnits.add(BigDecimal.valueOf(units(reqs.get(free.get(k)))));
        }
        List<BigDecimal> freeFreight = allocate(freightLeft, sum(freeNets).signum() > 0 ? freeNets : freeUnits);
        for (int k = 0; k < free.size(); k++) freightShares.set(free.get(k), freeFreight.get(k));

        bc.billShares = billShares;
        bc.freightShares = freightShares;
        bc.maths = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            BigDecimal net = reqs.get(i).getTotalAmount().setScale(2, HU).subtract(bc.itemDiscounts.get(i)).subtract(billShares.get(i));
            bc.maths.add(lineMath(gstPcts.get(i), net, freightShares.get(i), units(reqs.get(i))));
        }
    }

    private static final class LineMath {
        BigDecimal net;
        BigDecimal taxable;
        BigDecimal cgstPct;
        BigDecimal cgstAmt;
        BigDecimal purchRate;
        BigDecimal rateExcl;
    }

    /**
     * GST-inclusive line value → taxable and CGST/SGST, and the landed cost per unit:
     * (line value + its freight share) ÷ (paid + free units).
     */
    private static LineMath lineMath(BigDecimal gstPct, BigDecimal net, BigDecimal freight, int units) {
        LineMath m = new LineMath();
        m.net = net.setScale(2, HU);
        BigDecimal divisor = BigDecimal.ONE.add(gstPct.divide(HUNDRED, 6, HU));
        m.taxable = m.net.divide(divisor, 2, HU);
        m.cgstPct = gstPct.divide(BigDecimal.valueOf(2), 2, HU);
        m.cgstAmt = m.taxable.multiply(m.cgstPct).divide(HUNDRED, 2, HU);
        m.purchRate = m.net.add(zeroIfNull(freight)).divide(BigDecimal.valueOf(units), 2, HU);
        m.rateExcl = m.taxable.divide(BigDecimal.valueOf(units), 4, HU);
        return m;
    }

    public PurchaseDtos.PurchaseEntryResponse createPurchaseEntry(
            PurchaseDtos.CreatePurchaseRequest req, UUID createdById, UUID tenantId) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User createdBy = userRepository.findByIdAndTenantId(createdById, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", createdById.toString()));

        int seq = purchaseEntryRepository.findMaxEntrySequence(tenantId) + 1;
        String entryNumber = String.format("PUR-%d-%05d", Year.now().getValue(), seq);

        Supplier supplier = null;
        if (req.getSupplierId() != null) {
            supplier = supplierRepository.findByIdAndTenantId(req.getSupplierId(), tenantId).orElse(null);
        }

        PurchaseEntry entry = PurchaseEntry.builder()
                .tenant(tenant)
                .entryNumber(entryNumber)
                .supplierName(supplier != null ? supplier.getName() : req.getSupplierName())
                .supplier(supplier)
                .purchaseDate(req.getPurchaseDate())
                .invoiceNumber(req.getInvoiceNumber())
                .notes(req.getNotes())
                .createdBy(createdBy)
                .build();

        BigDecimal itemsNet      = BigDecimal.ZERO;
        BigDecimal totalTaxable  = BigDecimal.ZERO;
        BigDecimal totalCgst     = BigDecimal.ZERO;
        BigDecimal totalSgst     = BigDecimal.ZERO;
        String dateTag = req.getPurchaseDate().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int existingTodayCount = stockBatchRepository.countByTenantAndDate(tenantId, req.getPurchaseDate());
        AtomicInteger batchSeq = new AtomicInteger(existingTodayCount + 1);

        // Keep itemReqs in order so second loop can access min/max sale rates
        List<PurchaseDtos.PurchaseItemRequest> itemReqs = new ArrayList<>(req.getItems());

        // Batches for new lines are saved only after this loop, so two identical lines in the
        // SAME entry would each miss the DB merge lookup — this map lets them share one batch number.
        Map<String, String> intraEntryBatchNos = new java.util.HashMap<>();

        List<Product> products = new ArrayList<>();
        List<BigDecimal> gstPcts = new ArrayList<>();
        for (PurchaseDtos.PurchaseItemRequest itemReq : itemReqs) {
            Product product = productRepository.findByIdAndTenantId(itemReq.getProductId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId().toString()));
            products.add(product);
            gstPcts.add(product.getPurchaseGstPercent() != null ? product.getPurchaseGstPercent() : BigDecimal.ZERO);
        }
        BillCalc bc = calculateBill(itemReqs, products, gstPcts, req);
        List<BigDecimal> itemDiscounts = bc.itemDiscounts;
        List<BigDecimal> billShares = bc.billShares;
        List<BigDecimal> freightShares = bc.freightShares;
        BigDecimal billDiscount = bc.billDiscount;
        BigDecimal freight = bc.freight;

        for (int i = 0; i < itemReqs.size(); i++) {
            PurchaseDtos.PurchaseItemRequest itemReq = itemReqs.get(i);
            Product product = products.get(i);

            BigDecimal gstPct   = gstPcts.get(i);
            LineMath m          = bc.maths.get(i);
            BigDecimal netAmt   = m.net;
            BigDecimal taxable  = m.taxable;
            BigDecimal cgstPct  = m.cgstPct;
            BigDecimal cgstAmt  = m.cgstAmt;
            BigDecimal sgstAmt  = cgstAmt;
            BigDecimal gstAmt   = cgstAmt.add(sgstAmt);
            // scale 2 — must match StockBatch.purchaseRate's stored precision, else the merge lookup never matches
            BigDecimal purchRate = m.purchRate;
            BigDecimal rateExcl  = m.rateExcl;

            if (itemReq.getExpiryDate() == null) {
                throw new com.stockez.common.exception.BusinessException(
                    "Expiry date is required for '" + product.getName() + "'", "EXPIRY_DATE_REQUIRED");
            }
            if (itemReq.getMrp() == null || itemReq.getMrp().compareTo(BigDecimal.ZERO) <= 0) {
                throw new com.stockez.common.exception.BusinessException(
                    "MRP is required for '" + product.getName() + "'", "MRP_REQUIRED");
            }
            if (purchRate.compareTo(itemReq.getMrp()) > 0) {
                throw new com.stockez.common.exception.BusinessException(
                    "Purchase rate ₹" + purchRate.setScale(2, java.math.RoundingMode.HALF_UP) +
                    " for '" + product.getName() + "' cannot exceed MRP ₹" + itemReq.getMrp().setScale(2, java.math.RoundingMode.HALF_UP),
                    "PURCHASE_RATE_EXCEEDS_MRP");
            }
            if (itemReq.getMinSaleRate() == null) {
                throw new com.stockez.common.exception.BusinessException(
                    "Min sale rate is required for '" + product.getName() + "'", "MIN_SALE_RATE_REQUIRED");
            }
            if (itemReq.getMaxSaleRate() == null) {
                throw new com.stockez.common.exception.BusinessException(
                    "Max sale rate is required for '" + product.getName() + "'", "MAX_SALE_RATE_REQUIRED");
            }
            if (itemReq.getMinSaleRate() != null && purchRate.compareTo(BigDecimal.ZERO) > 0
                    && itemReq.getMinSaleRate().compareTo(purchRate) <= 0) {
                throw new com.stockez.common.exception.BusinessException(
                    "Min sale rate ₹" + itemReq.getMinSaleRate() + " for '" + product.getName() +
                    "' must be greater than purchase rate ₹" + purchRate.setScale(2, java.math.RoundingMode.HALF_UP),
                    "MIN_RATE_BELOW_PURCHASE");
            }

            // Merge into existing batch if same product + expiry + purchase rate + MRP; otherwise new batch
            String batchNumber;
            if (itemReq.getExpiryDate() != null && itemReq.getMrp() != null) {
                Optional<StockBatch> mergeable = stockBatchRepository.findMergeableBatch(
                        tenantId, product.getId(), itemReq.getExpiryDate(), purchRate, itemReq.getMrp());
                if (mergeable.isPresent()) {
                    batchNumber = mergeable.get().getBatchNumber();
                } else {
                    // No DB match — reuse a number already assigned to an identical line in this same entry.
                    String key = product.getId() + "|" + itemReq.getExpiryDate() + "|"
                            + purchRate.stripTrailingZeros().toPlainString() + "|"
                            + itemReq.getMrp().stripTrailingZeros().toPlainString();
                    batchNumber = intraEntryBatchNos.computeIfAbsent(key,
                            k -> String.format("BCH-%s-%03d", dateTag, batchSeq.getAndIncrement()));
                }
            } else {
                batchNumber = String.format("BCH-%s-%03d", dateTag, batchSeq.getAndIncrement());
            }

            itemsNet     = itemsNet.add(netAmt);
            totalTaxable = totalTaxable.add(taxable);
            totalCgst    = totalCgst.add(cgstAmt);
            totalSgst    = totalSgst.add(sgstAmt);

            PurchaseItem item = PurchaseItem.builder()
                    .purchaseEntry(entry)
                    .product(product)
                    .batchNumber(batchNumber)
                    .mrp(itemReq.getMrp())
                    .rateExclGst(rateExcl)
                    .discountPercent(itemReq.getDiscountPercent() != null ? itemReq.getDiscountPercent() : BigDecimal.ZERO)
                    .discountAmount(itemDiscounts.get(i))
                    .freeQty(itemReq.getFreeQty() != null ? itemReq.getFreeQty() : 0)
                    .billDiscountAmount(billShares.get(i))
                    .freightAmount(freightShares.get(i))
                    .taxableAmount(taxable)
                    .gstPercent(gstPct)
                    .gstAmount(gstAmt)
                    .cgstPercent(cgstPct)
                    .sgstPercent(cgstPct)
                    .cgstAmount(cgstAmt)
                    .sgstAmount(sgstAmt)
                    .purchaseRate(purchRate)
                    .mfgDate(itemReq.getMfgDate())
                    .expiryDate(itemReq.getExpiryDate())
                    .quantity(itemReq.getQuantity())
                    .amount(netAmt)
                    .build();

            entry.getItems().add(item);
        }

        BigDecimal cashDiscount = adjustmentAmount(req.getCashDiscountType(), req.getCashDiscountValue(), itemsNet, "Cash discount");
        BigDecimal roundOff = zeroIfNull(req.getRoundOffAmount()).setScale(2, HU);
        BigDecimal totalAmount = itemsNet.add(freight).subtract(cashDiscount).add(roundOff);
        if (totalAmount.signum() < 0) {
            throw new BusinessException("The bill total cannot be negative — check the discounts", "NEGATIVE_BILL_TOTAL");
        }

        entry.setBillDiscountType(billDiscount.signum() > 0 ? adjustmentType(req.getBillDiscountType()) : null);
        entry.setBillDiscountValue(billDiscount.signum() > 0 ? req.getBillDiscountValue().setScale(2, HU) : BigDecimal.ZERO);
        entry.setBillDiscountAmount(billDiscount);
        entry.setCashDiscountType(cashDiscount.signum() > 0 ? adjustmentType(req.getCashDiscountType()) : null);
        entry.setCashDiscountValue(cashDiscount.signum() > 0 ? req.getCashDiscountValue().setScale(2, HU) : BigDecimal.ZERO);
        entry.setCashDiscountAmount(cashDiscount);
        entry.setFreightAmount(freight);
        entry.setRoundOffAmount(roundOff);
        entry.setSupplierInvoiceTotal(req.getSupplierInvoiceTotal() != null ? req.getSupplierInvoiceTotal().setScale(2, HU) : null);
        entry.setTotalAmount(totalAmount);
        entry.setTotalTaxable(totalTaxable);
        entry.setTotalCgst(totalCgst);
        entry.setTotalSgst(totalSgst);
        PurchaseEntry saved = purchaseEntryRepository.save(entry);

        // Create or merge stock batches, then update product stock
        int idx = 0;
        for (PurchaseItem item : saved.getItems()) {
            PurchaseDtos.PurchaseItemRequest itemReq = itemReqs.get(idx++);
            Product product = item.getProduct();

            Optional<StockBatch> existingBatch = stockBatchRepository
                    .findByTenantAndBatchNumber(tenantId, item.getBatchNumber());

            if (existingBatch.isPresent()) {
                StockBatch batch = existingBatch.get();
                batch.setQuantityReceived(batch.getQuantityReceived() + item.getUnits());
                batch.setQuantityAvailable(batch.getQuantityAvailable() + item.getUnits());
                batch.setPurchaseItem(item);
                stockBatchRepository.save(batch);
            } else {
                BigDecimal minRate = itemReq.getMinSaleRate() != null ? itemReq.getMinSaleRate() : product.getMinSaleRate();
                BigDecimal maxRate = itemReq.getMaxSaleRate() != null ? itemReq.getMaxSaleRate() : product.getMaxSaleRate();
                StockBatch batch = StockBatch.builder()
                        .tenant(tenant)
                        .product(product)
                        .purchaseItem(item)
                        .batchNumber(item.getBatchNumber())
                        .mrp(item.getMrp())
                        .purchaseRate(item.getPurchaseRate())
                        .purchaseGstPercent(item.getGstPercent() != null ? item.getGstPercent() : BigDecimal.ZERO)
                        .minSaleRate(minRate)
                        .maxSaleRate(maxRate)
                        .mfgDate(item.getMfgDate())
                        .expiryDate(item.getExpiryDate())
                        .quantityReceived(item.getUnits())
                        .quantityAvailable(item.getUnits())
                        .receivedDate(req.getPurchaseDate())
                        .build();
                stockBatchRepository.save(batch);
                if (minRate != null) product.setMinSaleRate(minRate);
                if (maxRate != null) product.setMaxSaleRate(maxRate);
            }

            int currentStock = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
            product.setStockQuantity(currentStock + item.getUnits());
            product.setMrp(item.getMrp());
            if (item.getPurchaseRate().signum() > 0) product.setPurchaseRate(item.getPurchaseRate());
            productRepository.save(product);
        }

        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId)
                .entityType("PURCHASE")
                .entityId(saved.getId())
                .action("CREATED")
                .description(String.format("Purchase entry %s created — %d item(s), total ₹%s, supplier: %s",
                        saved.getEntryNumber(), saved.getItems().size(),
                        saved.getTotalAmount().toPlainString(), saved.getSupplierName()))
                .performedBy(createdBy.getFullName())
                .build());

        if (req.getDraftId() != null) purchaseDraftRepository.deleteOne(req.getDraftId(), tenantId);

        return toResponse(saved);
    }

    public PurchaseDtos.PurchaseEntryResponse updatePurchaseEntry(
            UUID id, UUID tenantId, UUID updatedById, PurchaseDtos.UpdatePurchaseRequest req) {
        PurchaseEntry entry = purchaseEntryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", id.toString()));
        Tenant tenant = entry.getTenant();
        if ("VOID".equals(entry.getStatus())) {
            throw new BusinessException("Purchase entry " + entry.getEntryNumber() + " is voided and cannot be edited", "ENTRY_VOID");
        }

        List<String> changes = new ArrayList<>();
        if (!entry.getSupplierName().equals(req.getSupplierName()))
            changes.add("supplier '" + entry.getSupplierName() + "' → '" + req.getSupplierName() + "'");
        if (!entry.getPurchaseDate().equals(req.getPurchaseDate()))
            changes.add("date " + entry.getPurchaseDate() + " → " + req.getPurchaseDate());
        String oldInv = entry.getInvoiceNumber() != null ? entry.getInvoiceNumber() : "";
        String newInv = req.getInvoiceNumber()   != null ? req.getInvoiceNumber()   : "";
        if (!oldInv.equals(newInv))
            changes.add("invoice '" + oldInv + "' → '" + newInv + "'");

        entry.setSupplierName(req.getSupplierName());
        entry.setPurchaseDate(req.getPurchaseDate());
        entry.setInvoiceNumber(req.getInvoiceNumber());
        entry.setNotes(req.getNotes());
        if (req.getSupplierId() != null) {
            // The linked supplier's own name wins, as on create — supplier balances, returns and the
            // supplier statement all match bills by name.
            supplierRepository.findByIdAndTenantId(req.getSupplierId(), tenantId).ifPresent(s -> {
                entry.setSupplier(s);
                entry.setSupplierName(s.getName());
            });
        }

        // ── Remove lines entered by mistake ──────────────────────────────────
        // Only while nothing from that line's batch has sold — reverses the stock it added and
        // deletes the row outright (orphanRemoval), as if it was never entered.
        if (req.getRemoveItemIds() != null) {
            for (UUID removeId : req.getRemoveItemIds()) {
                PurchaseItem item = entry.getItems().stream()
                        .filter(i -> i.getId().equals(removeId))
                        .findFirst().orElse(null);
                if (item == null) continue;

                StockBatch batch = stockBatchRepository
                        .findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).orElse(null);
                int soldQty = batch != null ? item.getUnits() - batch.getQuantityAvailable() : 0;
                if (soldQty > 0) {
                    throw new BusinessException(
                        "Cannot remove '" + item.getProduct().getName() + "' — " + soldQty +
                        " unit(s) from this batch are already sold. Trim the quantity to " + soldQty +
                        " instead of removing the line.", "LINE_REMOVE_EXCEEDS_SOLD");
                }
                if (batch != null) {
                    batch.setQuantityReceived(batch.getQuantityReceived() - item.getUnits());
                    batch.setQuantityAvailable(batch.getQuantityAvailable() - item.getUnits());
                    batch.setActive(batch.getQuantityAvailable() > 0);
                    detachBatchFromItem(batch, item);
                    stockBatchRepository.save(batch);
                }
                Product product = item.getProduct();
                product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) - item.getUnits());
                productRepository.save(product);

                changes.add("removed '" + product.getName() + "' x" + item.getUnits());
                entry.getItems().remove(item);
            }
            if (entry.getItems().isEmpty() && !"VOID".equals(entry.getStatus())) {
                entry.setStatus("VOID");
                changes.add("entry auto-voided — no lines remain");
            }
        }

        // ── Update existing items ────────────────────────────────────────────
        if (req.getItemUpdates() != null) {
            for (PurchaseDtos.BatchItemUpdate u : req.getItemUpdates()) {
                PurchaseItem item = entry.getItems().stream()
                        .filter(i -> i.getId().equals(u.getItemId()))
                        .findFirst().orElse(null);
                if (item == null) continue;

                StockBatch batch = stockBatchRepository
                        .findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).orElse(null);

                // Quantity and/or rate (mistakenly-entered price) change — recomputed together since
                // both drive the item's financials.
                boolean qtyChanged  = u.getQuantity() != null && !u.getQuantity().equals(item.getQuantity());
                boolean rateChanged = u.getTotalAmount() != null && u.getTotalAmount().compareTo(item.getAmount()) != 0;
                if (qtyChanged || rateChanged) {
                    int oldQty = item.getQuantity();
                    int newQty = u.getQuantity() != null ? u.getQuantity() : oldQty;
                    int delta  = newQty - oldQty;
                    int freeQty = item.getFreeQty() != null ? item.getFreeQty() : 0;
                    int newUnits = newQty + freeQty;
                    if (newUnits <= 0) {
                        throw new BusinessException("Quantity for '" + item.getProduct().getName()
                                + "' cannot be zero — remove the line instead", "QTY_REQUIRED");
                    }
                    BigDecimal lineFreight = zeroIfNull(item.getFreightAmount());

                    // A rate correction rewrites this batch's cost basis — only safe while nothing
                    // from it has sold yet (FIFO cost for sold units is already locked in), and only
                    // when the batch isn't shared with other purchases (merged by rate+MRP+expiry).
                    if (rateChanged) {
                        int soldQty = batch != null ? item.getUnits() - batch.getQuantityAvailable() : 0;
                        if (soldQty > 0) {
                            throw new BusinessException(
                                "Cannot change the rate for '" + item.getProduct().getName() + "' — " + soldQty +
                                " unit(s) from this batch are already sold, which would rewrite their recorded cost. " +
                                "Reduce this line's quantity to " + soldQty + " and add a new line at the correct rate for the rest.",
                                "RATE_CHANGE_EXCEEDS_SOLD");
                        }
                        if (batch != null && purchaseEntryRepository.countItemsSharingBatch(tenantId, item.getBatchNumber()) > 1) {
                            throw new BusinessException(
                                "Batch " + item.getBatchNumber() + " is shared by multiple purchases (merged by the same " +
                                "rate, MRP and expiry). Changing its rate here would affect those other purchases too.",
                                "SHARED_BATCH_FIELD_LOCKED");
                        }
                    }
                    if (batch != null && delta < 0 && batch.getQuantityAvailable() < Math.abs(delta)) {
                        int soldQty = item.getUnits() - batch.getQuantityAvailable();
                        throw new BusinessException(
                            "Cannot reduce '" + item.getProduct().getName() + "' below " + soldQty +
                            " — " + soldQty + " unit(s) already sold.",
                            "QTY_REDUCE_EXCEEDS_SOLD");
                    }

                    // Recalculate item financials — from the corrected total when the rate changed,
                    // otherwise from the existing per-unit landed cost at the new quantity. Free units
                    // and the line's freight share stay as they were on the bill.
                    BigDecimal newNetAmt = rateChanged
                            ? u.getTotalAmount().setScale(2, RoundingMode.HALF_UP)
                            : item.getPurchaseRate().multiply(BigDecimal.valueOf(newUnits)).subtract(lineFreight)
                                    .max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
                    BigDecimal newPurchRate = newNetAmt.add(lineFreight).divide(BigDecimal.valueOf(newUnits), 2, RoundingMode.HALF_UP);
                    BigDecimal effectiveMrp = u.getMrp() != null ? u.getMrp() : item.getMrp();
                    if (rateChanged && effectiveMrp != null && newPurchRate.compareTo(effectiveMrp) > 0) {
                        throw new BusinessException(
                            "Purchase rate ₹" + newPurchRate + " for '" + item.getProduct().getName() +
                            "' cannot exceed MRP ₹" + effectiveMrp, "PURCHASE_RATE_EXCEEDS_MRP");
                    }
                    BigDecimal divisor    = BigDecimal.ONE.add(item.getGstPercent().divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
                    BigDecimal newTaxable = newNetAmt.divide(divisor, 2, RoundingMode.HALF_UP);
                    BigDecimal newCgstAmt = newTaxable.multiply(item.getCgstPercent()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

                    if (batch != null) {
                        batch.setQuantityReceived(batch.getQuantityReceived() + delta);
                        batch.setQuantityAvailable(batch.getQuantityAvailable() + delta);
                        batch.setActive(batch.getQuantityAvailable() > 0);
                        if (rateChanged) batch.setPurchaseRate(newPurchRate);
                    }
                    item.setQuantity(newQty);
                    item.setAmount(newNetAmt);
                    item.setTaxableAmount(newTaxable);
                    item.setCgstAmount(newCgstAmt);
                    item.setSgstAmount(newCgstAmt);
                    item.setGstAmount(newCgstAmt.add(newCgstAmt));
                    if (rateChanged) {
                        item.setPurchaseRate(newPurchRate);
                        item.setRateExclGst(newTaxable.divide(BigDecimal.valueOf(newUnits), 4, RoundingMode.HALF_UP));
                    }

                    Product product = item.getProduct();
                    product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) + delta);
                    if (rateChanged) product.setPurchaseRate(newPurchRate);
                    productRepository.save(product);

                    if (qtyChanged)  changes.add("qty for '" + item.getProduct().getName() + "': " + oldQty + " → " + newQty);
                    if (rateChanged) changes.add("rate for '" + item.getProduct().getName() + "' → ₹" + newPurchRate.toPlainString());
                }

                // A batch merged across multiple purchases must not have its MRP/expiry rewritten from
                // one purchase — it would silently change the others sharing it. Block with a message.
                boolean mrpChange    = u.getMrp() != null
                        && (item.getMrp() == null || item.getMrp().compareTo(u.getMrp()) != 0);
                boolean expiryChange = u.getExpiryDate() != null
                        && !u.getExpiryDate().equals(item.getExpiryDate());
                if ((mrpChange || expiryChange) && batch != null
                        && purchaseEntryRepository.countItemsSharingBatch(tenantId, item.getBatchNumber()) > 1) {
                    throw new BusinessException(
                        "Batch " + item.getBatchNumber() + " is shared by multiple purchases (merged by the same " +
                        "rate, MRP and expiry). Changing its MRP or expiry here would affect those other purchases too — " +
                        "edit the stock batch directly instead.",
                        "SHARED_BATCH_FIELD_LOCKED");
                }

                // Sale-rate limits — checked only when this edit touches them, the MRP or the rate,
                // so an unrelated edit never trips over limits saved long ago.
                if (batch != null) {
                    BigDecimal newMin = u.getMinSaleRate() != null ? u.getMinSaleRate() : batch.getMinSaleRate();
                    BigDecimal newMax = u.getMaxSaleRate() != null ? u.getMaxSaleRate() : batch.getMaxSaleRate();
                    BigDecimal newMrp = u.getMrp() != null ? u.getMrp() : item.getMrp();
                    boolean limitsTouched = mrpChange || differs(u.getMinSaleRate(), batch.getMinSaleRate())
                            || differs(u.getMaxSaleRate(), batch.getMaxSaleRate()) || rateChanged;
                    if (limitsTouched) validateSaleLimits(item.getProduct().getName(), item.getPurchaseRate(), newMin, newMax, newMrp);
                }

                // Field updates on item and batch
                if (u.getMrp() != null)        item.setMrp(u.getMrp());
                if (u.getExpiryDate() != null) item.setExpiryDate(u.getExpiryDate());
                if (u.getMfgDate() != null)    item.setMfgDate(u.getMfgDate());
                if (batch != null) {
                    if (u.getMrp() != null)         batch.setMrp(u.getMrp());
                    if (u.getExpiryDate() != null)  batch.setExpiryDate(u.getExpiryDate());
                    if (u.getMfgDate() != null)     batch.setMfgDate(u.getMfgDate());
                    if (u.getMinSaleRate() != null) batch.setMinSaleRate(u.getMinSaleRate());
                    if (u.getMaxSaleRate() != null) batch.setMaxSaleRate(u.getMaxSaleRate());
                    stockBatchRepository.save(batch);
                }
            }
        }

        // ── Add new items ────────────────────────────────────────────────────
        if (req.getNewItems() != null && !req.getNewItems().isEmpty()) {
            String dateTag = entry.getPurchaseDate().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
            int existingCount = stockBatchRepository.countByTenantAndDate(tenantId, entry.getPurchaseDate());
            AtomicInteger batchSeq = new AtomicInteger(existingCount + 1);

            for (PurchaseDtos.PurchaseItemRequest itemReq : req.getNewItems()) {
                Product product = productRepository.findByIdAndTenantId(itemReq.getProductId(), tenantId)
                        .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId().toString()));

                validateUnits(itemReq, product.getName());
                BigDecimal gstPct   = product.getPurchaseGstPercent() != null ? product.getPurchaseGstPercent() : BigDecimal.ZERO;
                BigDecimal disAmt   = lineDiscount(itemReq, product.getName());
                int lineUnits       = units(itemReq);
                LineMath m          = lineMath(gstPct, itemReq.getTotalAmount().setScale(2, HU).subtract(disAmt), BigDecimal.ZERO, lineUnits);
                BigDecimal netAmt   = m.net;
                BigDecimal taxable  = m.taxable;
                BigDecimal cgstPct  = m.cgstPct;
                BigDecimal cgstAmt  = m.cgstAmt;
                // scale 2 — must match StockBatch.purchaseRate's stored precision, else the merge lookup never matches
                BigDecimal purchRate = m.purchRate;
                BigDecimal rateExcl  = m.rateExcl;

                if (itemReq.getExpiryDate() == null) throw new BusinessException("Expiry date is required for '" + product.getName() + "'", "EXPIRY_DATE_REQUIRED");
                if (itemReq.getMrp() == null || itemReq.getMrp().compareTo(BigDecimal.ZERO) <= 0)
                    throw new BusinessException("MRP is required for '" + product.getName() + "'", "MRP_REQUIRED");
                if (purchRate.compareTo(itemReq.getMrp()) > 0)
                    throw new BusinessException(
                        "Purchase rate ₹" + purchRate.setScale(2, RoundingMode.HALF_UP) +
                        " for '" + product.getName() + "' cannot exceed MRP ₹" + itemReq.getMrp().setScale(2, RoundingMode.HALF_UP),
                        "PURCHASE_RATE_EXCEEDS_MRP");
                if (itemReq.getMinSaleRate() == null) throw new BusinessException("Min sale rate is required for '" + product.getName() + "'", "MIN_SALE_RATE_REQUIRED");
                if (itemReq.getMaxSaleRate() == null) throw new BusinessException("Max sale rate is required for '" + product.getName() + "'", "MAX_SALE_RATE_REQUIRED");
                validateSaleLimits(product.getName(), purchRate, itemReq.getMinSaleRate(), itemReq.getMaxSaleRate(), itemReq.getMrp());

                String batchNumber;
                Optional<StockBatch> mergeable = (itemReq.getExpiryDate() != null && itemReq.getMrp() != null)
                        ? stockBatchRepository.findMergeableBatch(tenantId, product.getId(), itemReq.getExpiryDate(), purchRate, itemReq.getMrp())
                        : Optional.empty();
                batchNumber = mergeable.map(StockBatch::getBatchNumber)
                        .orElse(String.format("BCH-%s-%03d", dateTag, batchSeq.getAndIncrement()));

                PurchaseItem newItem = PurchaseItem.builder()
                        .purchaseEntry(entry).product(product).batchNumber(batchNumber)
                        .mrp(itemReq.getMrp()).rateExclGst(rateExcl)
                        .discountPercent(itemReq.getDiscountPercent() != null ? itemReq.getDiscountPercent() : BigDecimal.ZERO)
                        .discountAmount(disAmt).freeQty(itemReq.getFreeQty() != null ? itemReq.getFreeQty() : 0)
                        .taxableAmount(taxable).gstPercent(gstPct).gstAmount(cgstAmt.add(cgstAmt))
                        .cgstPercent(cgstPct).sgstPercent(cgstPct).cgstAmount(cgstAmt).sgstAmount(cgstAmt)
                        .purchaseRate(purchRate).mfgDate(itemReq.getMfgDate()).expiryDate(itemReq.getExpiryDate())
                        .quantity(itemReq.getQuantity()).amount(netAmt).build();
                entry.getItems().add(newItem);

                Optional<StockBatch> existingBatch = stockBatchRepository.findByTenantAndBatchNumber(tenantId, batchNumber);
                if (existingBatch.isPresent()) {
                    StockBatch b = existingBatch.get();
                    b.setQuantityReceived(b.getQuantityReceived() + lineUnits);
                    b.setQuantityAvailable(b.getQuantityAvailable() + lineUnits);
                    stockBatchRepository.save(b);
                } else {
                    StockBatch b = StockBatch.builder()
                            .tenant(tenant).product(product).batchNumber(batchNumber)
                            .mrp(itemReq.getMrp()).purchaseRate(purchRate).purchaseGstPercent(gstPct)
                            .minSaleRate(itemReq.getMinSaleRate()).maxSaleRate(itemReq.getMaxSaleRate())
                            .mfgDate(itemReq.getMfgDate()).expiryDate(itemReq.getExpiryDate())
                            .quantityReceived(lineUnits).quantityAvailable(lineUnits)
                            .receivedDate(entry.getPurchaseDate()).build();
                    stockBatchRepository.save(b);
                    product.setMinSaleRate(itemReq.getMinSaleRate());
                    product.setMaxSaleRate(itemReq.getMaxSaleRate());
                }
                product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) + lineUnits);
                if (purchRate.signum() > 0) product.setPurchaseRate(purchRate);
                productRepository.save(product);
                changes.add("added '" + product.getName() + "' x" + lineUnits);
            }
        }

        // ── Recalculate entry totals ─────────────────────────────────────────
        // Bill adjustments entered on the original bill (cash discount, round-off) are kept as they
        // were; the bill discount and freight follow whichever lines remain.
        BigDecimal itemsNet = BigDecimal.ZERO, totalTaxable = BigDecimal.ZERO, totalCgst = BigDecimal.ZERO, totalSgst = BigDecimal.ZERO;
        BigDecimal billDiscountLeft = BigDecimal.ZERO, freightLeft = BigDecimal.ZERO;
        for (PurchaseItem item : entry.getItems()) {
            itemsNet     = itemsNet.add(item.getAmount());
            totalTaxable = totalTaxable.add(item.getTaxableAmount());
            totalCgst    = totalCgst.add(item.getCgstAmount());
            totalSgst    = totalSgst.add(item.getSgstAmount());
            billDiscountLeft = billDiscountLeft.add(zeroIfNull(item.getBillDiscountAmount()));
            freightLeft      = freightLeft.add(zeroIfNull(item.getFreightAmount()));
        }
        entry.setBillDiscountAmount(billDiscountLeft);
        entry.setFreightAmount(freightLeft);
        BigDecimal totalAmount = itemsNet.add(freightLeft)
                .subtract(zeroIfNull(entry.getCashDiscountAmount()))
                .add(zeroIfNull(entry.getRoundOffAmount()))
                .max(BigDecimal.ZERO);
        if (entry.getItems().isEmpty()) totalAmount = BigDecimal.ZERO;
        if (totalAmount.compareTo(zeroIfNull(entry.getPaidAmount())) < 0) {
            throw new BusinessException("This change brings the bill total to ₹" + totalAmount.toPlainString()
                    + ", below the ₹" + entry.getPaidAmount().toPlainString() + " already paid to the supplier. "
                    + "Reverse the extra payment first.", "TOTAL_BELOW_PAID");
        }
        entry.setTotalAmount(totalAmount);
        entry.setTotalTaxable(totalTaxable);
        entry.setTotalCgst(totalCgst);
        entry.setTotalSgst(totalSgst);

        PurchaseEntry saved = purchaseEntryRepository.save(entry);

        String performer = userRepository.findById(updatedById).map(User::getFullName).orElse("Unknown");
        String desc = changes.isEmpty()
                ? "Purchase entry " + saved.getEntryNumber() + " updated (no field changes)"
                : "Updated " + saved.getEntryNumber() + ": " + String.join(", ", changes);
        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId).entityType("PURCHASE").entityId(saved.getId()).action("UPDATED")
                .description(desc).performedBy(performer).build());

        return toResponse(saved);
    }

    /**
     * Edits a purchase on the same screen it was entered on: the request is the whole bill again.
     * Lines carrying an itemId are existing lines, lines without one are new, and existing lines
     * left out are removed. Everything is recalculated exactly as on create; stock moves by the
     * difference. Safety: a line with sold units can only shrink to its sold count and its cost
     * (purchase rate) cannot change — which also locks a bill discount or freight change that would
     * re-spread cost onto it; a batch shared with another purchase keeps its cost, MRP and expiry;
     * and the bill total can never drop below what is already paid.
     */
    public PurchaseDtos.PurchaseEntryResponse replacePurchaseEntry(
            UUID id, UUID tenantId, UUID updatedById, PurchaseDtos.CreatePurchaseRequest req) {
        PurchaseEntry entry = purchaseEntryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", id.toString()));
        if ("VOID".equals(entry.getStatus())) {
            throw new BusinessException("Purchase entry " + entry.getEntryNumber() + " is voided and cannot be edited", "ENTRY_VOID");
        }
        Tenant tenant = entry.getTenant();
        List<String> changes = new ArrayList<>();

        // ── Header ───────────────────────────────────────────────────────────
        Supplier supplier = req.getSupplierId() != null
                ? supplierRepository.findByIdAndTenantId(req.getSupplierId(), tenantId).orElse(null)
                : null;
        String supplierName = supplier != null ? supplier.getName() : req.getSupplierName();
        if (!entry.getSupplierName().equals(supplierName))
            changes.add("supplier '" + entry.getSupplierName() + "' → '" + supplierName + "'");
        if (!entry.getPurchaseDate().equals(req.getPurchaseDate()))
            changes.add("date " + entry.getPurchaseDate() + " → " + req.getPurchaseDate());
        String oldInv = entry.getInvoiceNumber() != null ? entry.getInvoiceNumber() : "";
        String newInv = req.getInvoiceNumber() != null ? req.getInvoiceNumber() : "";
        if (!oldInv.equals(newInv)) changes.add("invoice '" + oldInv + "' → '" + newInv + "'");
        if (supplier != null) entry.setSupplier(supplier);
        entry.setSupplierName(supplierName);
        entry.setPurchaseDate(req.getPurchaseDate());
        entry.setInvoiceNumber(req.getInvoiceNumber());
        entry.setNotes(req.getNotes());

        // ── Match request lines to existing lines ────────────────────────────
        Map<UUID, PurchaseItem> existing = new java.util.LinkedHashMap<>();
        entry.getItems().forEach(i -> existing.put(i.getId(), i));
        List<PurchaseDtos.PurchaseItemRequest> reqs = new ArrayList<>(req.getItems());
        List<PurchaseItem> matched = new ArrayList<>();
        List<Product> products = new ArrayList<>();
        List<BigDecimal> gstPcts = new ArrayList<>();
        for (PurchaseDtos.PurchaseItemRequest r : reqs) {
            PurchaseItem old = r.getItemId() != null ? existing.get(r.getItemId()) : null;
            if (r.getItemId() != null && old == null) {
                throw new BusinessException("A line on this bill was changed elsewhere — reopen the entry and try again", "ITEM_NOT_FOUND");
            }
            if (old != null && !old.getProduct().getId().equals(r.getProductId())) {
                throw new BusinessException("The product on an existing line cannot be changed — remove that line and add a new one",
                        "LINE_PRODUCT_LOCKED");
            }
            Product product = old != null ? old.getProduct()
                    : productRepository.findByIdAndTenantId(r.getProductId(), tenantId)
                        .orElseThrow(() -> new ResourceNotFoundException("Product", r.getProductId().toString()));
            matched.add(old);
            products.add(product);
            // An existing line keeps the GST it was bought at, even if the product's rate changed since.
            gstPcts.add(old != null ? old.getGstPercent()
                    : (product.getPurchaseGstPercent() != null ? product.getPurchaseGstPercent() : BigDecimal.ZERO));
        }
        BillCalc bc = calculateBill(reqs, products, gstPcts, req);
        pinSoldLineShares(bc, reqs, matched, gstPcts, tenantId);

        // ── Removed lines ────────────────────────────────────────────────────
        java.util.Set<UUID> keptIds = new java.util.HashSet<>();
        matched.forEach(m -> { if (m != null) keptIds.add(m.getId()); });
        for (PurchaseItem item : new ArrayList<>(entry.getItems())) {
            if (keptIds.contains(item.getId())) continue;
            StockBatch batch = stockBatchRepository.findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).orElse(null);
            int soldQty = batch != null ? item.getUnits() - batch.getQuantityAvailable() : 0;
            if (soldQty > 0) {
                throw new BusinessException("Cannot remove '" + item.getProduct().getName() + "' — " + soldQty
                        + " unit(s) from this batch are already sold. Reduce its quantity instead.", "LINE_REMOVE_EXCEEDS_SOLD");
            }
            if (batch != null) {
                batch.setQuantityReceived(batch.getQuantityReceived() - item.getUnits());
                batch.setQuantityAvailable(batch.getQuantityAvailable() - item.getUnits());
                batch.setActive(batch.getQuantityAvailable() > 0);
                detachBatchFromItem(batch, item);
                stockBatchRepository.save(batch);
            }
            Product product = item.getProduct();
            product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) - item.getUnits());
            productRepository.save(product);
            changes.add("removed '" + product.getName() + "' x" + item.getUnits());
            entry.getItems().remove(item);
        }

        // ── Kept and new lines ───────────────────────────────────────────────
        String dateTag = entry.getPurchaseDate().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        AtomicInteger batchSeq = new AtomicInteger(stockBatchRepository.countByTenantAndDate(tenantId, entry.getPurchaseDate()) + 1);
        Map<String, String> intraEntryBatchNos = new java.util.HashMap<>();
        List<StockBatch> newBatches = new ArrayList<>();
        BigDecimal itemsNet = BigDecimal.ZERO, totalTaxable = BigDecimal.ZERO, totalCgst = BigDecimal.ZERO;

        for (int i = 0; i < reqs.size(); i++) {
            PurchaseDtos.PurchaseItemRequest r = reqs.get(i);
            Product product = products.get(i);
            PurchaseItem old = matched.get(i);
            LineMath m = bc.maths.get(i);
            int newUnits = units(r);
            String name = product.getName();

            if (r.getExpiryDate() == null) throw new BusinessException("Expiry date is required for '" + name + "'", "EXPIRY_DATE_REQUIRED");
            if (r.getMrp() == null || r.getMrp().signum() <= 0) throw new BusinessException("MRP is required for '" + name + "'", "MRP_REQUIRED");
            if (m.purchRate.compareTo(r.getMrp()) > 0) {
                throw new BusinessException("Purchase rate ₹" + m.purchRate.toPlainString() + " for '" + name
                        + "' cannot exceed MRP ₹" + r.getMrp().setScale(2, HU).toPlainString(), "PURCHASE_RATE_EXCEEDS_MRP");
            }
            if (r.getMinSaleRate() == null) throw new BusinessException("Min sale rate is required for '" + name + "'", "MIN_SALE_RATE_REQUIRED");
            if (r.getMaxSaleRate() == null) throw new BusinessException("Max sale rate is required for '" + name + "'", "MAX_SALE_RATE_REQUIRED");
            validateSaleLimits(name, m.purchRate, r.getMinSaleRate(), r.getMaxSaleRate(), r.getMrp());

            PurchaseItem item;
            StockBatch newBatch = null;
            BigDecimal finalRate = m.purchRate;
            if (old == null) {
                Optional<StockBatch> mergeable = stockBatchRepository.findMergeableBatch(
                        tenantId, product.getId(), r.getExpiryDate(), m.purchRate, r.getMrp());
                String batchNumber = mergeable.map(StockBatch::getBatchNumber).orElseGet(() -> {
                    String key = product.getId() + "|" + r.getExpiryDate() + "|"
                            + m.purchRate.stripTrailingZeros().toPlainString() + "|" + r.getMrp().stripTrailingZeros().toPlainString();
                    return intraEntryBatchNos.computeIfAbsent(key, k -> String.format("BCH-%s-%03d", dateTag, batchSeq.getAndIncrement()));
                });
                // Joins the bill only once all its fields are set below — a query in between flushes it.
                item = PurchaseItem.builder().purchaseEntry(entry).product(product).batchNumber(batchNumber).build();

                StockBatch batch = stockBatchRepository.findByTenantAndBatchNumber(tenantId, batchNumber).orElse(null);
                if (batch != null) {
                    batch.setQuantityReceived(batch.getQuantityReceived() + newUnits);
                    batch.setQuantityAvailable(batch.getQuantityAvailable() + newUnits);
                    batch.setActive(true);
                    stockBatchRepository.save(batch);
                } else {
                    newBatch = stockBatchRepository.save(StockBatch.builder()
                            .tenant(tenant).product(product).batchNumber(batchNumber)
                            .mrp(r.getMrp()).purchaseRate(m.purchRate).purchaseGstPercent(gstPcts.get(i))
                            .minSaleRate(r.getMinSaleRate()).maxSaleRate(r.getMaxSaleRate())
                            .mfgDate(r.getMfgDate()).expiryDate(r.getExpiryDate())
                            .quantityReceived(newUnits).quantityAvailable(newUnits)
                            .receivedDate(entry.getPurchaseDate()).build());
                    product.setMinSaleRate(r.getMinSaleRate());
                    product.setMaxSaleRate(r.getMaxSaleRate());
                }
                product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) + newUnits);
                product.setMrp(r.getMrp());
                if (m.purchRate.signum() > 0) product.setPurchaseRate(m.purchRate);
                productRepository.save(product);
                changes.add("added '" + name + "' x" + newUnits);
            } else {
                item = old;
                StockBatch batch = stockBatchRepository.findByTenantAndBatchNumber(tenantId, old.getBatchNumber()).orElse(null);
                int oldUnits = old.getUnits();
                int sold = batch != null ? Math.max(oldUnits - batch.getQuantityAvailable(), 0) : 0;
                boolean shared = batch != null && purchaseEntryRepository.countItemsSharingBatch(tenantId, old.getBatchNumber()) > 1;
                // A paisa of drift (a qty cut scaled proportionally, re-rounded) is not a cost change.
                boolean costChanged = m.purchRate.subtract(old.getPurchaseRate()).abs().compareTo(new BigDecimal("0.01")) > 0;
                if (!costChanged) finalRate = old.getPurchaseRate();
                boolean mrpChanged = old.getMrp() == null || r.getMrp().compareTo(old.getMrp()) != 0;
                boolean expiryChanged = !r.getExpiryDate().equals(old.getExpiryDate());

                if (newUnits < sold) {
                    throw new BusinessException("Cannot reduce '" + name + "' below " + sold + " unit(s) — they are already sold.",
                            "QTY_REDUCE_EXCEEDS_SOLD");
                }
                if (costChanged && sold > 0) {
                    throw new BusinessException("The cost of '" + name + "' would change from ₹"
                            + old.getPurchaseRate().setScale(2, HU).toPlainString() + " to ₹" + m.purchRate.toPlainString()
                            + ", but " + sold + " unit(s) are already sold at the recorded cost. Keep its amount, discount and "
                            + "free qty — and the bill discount and freight — as they were.", "RATE_CHANGE_EXCEEDS_SOLD");
                }
                if ((costChanged || mrpChanged || expiryChanged) && shared) {
                    throw new BusinessException("Batch " + old.getBatchNumber() + " of '" + name + "' is shared with another purchase "
                            + "(same rate, MRP and expiry), so its cost, MRP and expiry can't be changed from this bill.",
                            "SHARED_BATCH_FIELD_LOCKED");
                }
                int delta = newUnits - oldUnits;
                if (batch != null) {
                    if (delta < 0 && batch.getQuantityAvailable() < -delta) {
                        throw new BusinessException("Cannot reduce '" + name + "' by " + (-delta) + " — only "
                                + batch.getQuantityAvailable() + " unit(s) of its batch are still in stock.", "QTY_REDUCE_EXCEEDS_SOLD");
                    }
                    batch.setQuantityReceived(batch.getQuantityReceived() + delta);
                    batch.setQuantityAvailable(batch.getQuantityAvailable() + delta);
                    batch.setActive(batch.getQuantityAvailable() > 0);
                    if (costChanged) batch.setPurchaseRate(m.purchRate);
                    batch.setMrp(r.getMrp());
                    batch.setExpiryDate(r.getExpiryDate());
                    if (r.getMfgDate() != null) batch.setMfgDate(r.getMfgDate());
                    batch.setMinSaleRate(r.getMinSaleRate());
                    batch.setMaxSaleRate(r.getMaxSaleRate());
                    stockBatchRepository.save(batch);
                }
                product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) + delta);
                if (costChanged && m.purchRate.signum() > 0) product.setPurchaseRate(m.purchRate);
                productRepository.save(product);

                if (old.getQuantity() != null && !old.getQuantity().equals(r.getQuantity()))
                    changes.add("qty for '" + name + "': " + old.getQuantity() + " → " + r.getQuantity());
                int oldFree = old.getFreeQty() != null ? old.getFreeQty() : 0;
                int newFree = r.getFreeQty() != null ? r.getFreeQty() : 0;
                if (oldFree != newFree) changes.add("free qty for '" + name + "': " + oldFree + " → " + newFree);
                if (costChanged) changes.add("cost for '" + name + "': ₹" + old.getPurchaseRate().setScale(2, HU).toPlainString()
                        + " → ₹" + m.purchRate.toPlainString());
                if (mrpChanged) changes.add("MRP for '" + name + "' → ₹" + r.getMrp().setScale(2, HU).toPlainString());
                if (expiryChanged) changes.add("expiry for '" + name + "' → " + r.getExpiryDate());
            }

            item.setMrp(r.getMrp());
            item.setRateExclGst(m.rateExcl);
            item.setDiscountPercent(r.getDiscountPercent() != null ? r.getDiscountPercent() : BigDecimal.ZERO);
            item.setDiscountAmount(bc.itemDiscounts.get(i));
            item.setFreeQty(r.getFreeQty() != null ? r.getFreeQty() : 0);
            item.setBillDiscountAmount(bc.billShares.get(i));
            item.setFreightAmount(bc.freightShares.get(i));
            item.setTaxableAmount(m.taxable);
            item.setGstPercent(gstPcts.get(i));
            item.setCgstPercent(m.cgstPct);
            item.setSgstPercent(m.cgstPct);
            item.setCgstAmount(m.cgstAmt);
            item.setSgstAmount(m.cgstAmt);
            item.setGstAmount(m.cgstAmt.add(m.cgstAmt));
            item.setPurchaseRate(finalRate);
            item.setMfgDate(r.getMfgDate());
            item.setExpiryDate(r.getExpiryDate());
            item.setQuantity(r.getQuantity());
            item.setAmount(m.net);
            if (old == null) {
                entry.getItems().add(item);
                if (newBatch != null) newBatches.add(newBatch);
            }

            itemsNet = itemsNet.add(m.net);
            totalTaxable = totalTaxable.add(m.taxable);
            totalCgst = totalCgst.add(m.cgstAmt);
        }

        // ── Bill totals ──────────────────────────────────────────────────────
        BigDecimal cashDiscount = adjustmentAmount(req.getCashDiscountType(), req.getCashDiscountValue(), itemsNet, "Cash discount");
        BigDecimal roundOff = zeroIfNull(req.getRoundOffAmount()).setScale(2, HU);
        BigDecimal totalAmount = itemsNet.add(bc.freight).subtract(cashDiscount).add(roundOff);
        if (totalAmount.signum() < 0) {
            throw new BusinessException("The bill total cannot be negative — check the discounts", "NEGATIVE_BILL_TOTAL");
        }
        if (totalAmount.compareTo(zeroIfNull(entry.getPaidAmount())) < 0) {
            throw new BusinessException("This change brings the bill total to ₹" + totalAmount.toPlainString()
                    + ", below the ₹" + entry.getPaidAmount().toPlainString() + " already paid to the supplier. "
                    + "Reverse the extra payment first.", "TOTAL_BELOW_PAID");
        }
        if (entry.getTotalAmount().compareTo(totalAmount) != 0) {
            changes.add("bill total ₹" + entry.getTotalAmount().toPlainString() + " → ₹" + totalAmount.toPlainString());
        }

        entry.setBillDiscountType(bc.billDiscount.signum() > 0 ? adjustmentType(req.getBillDiscountType()) : null);
        entry.setBillDiscountValue(bc.billDiscount.signum() > 0 ? req.getBillDiscountValue().setScale(2, HU) : BigDecimal.ZERO);
        entry.setBillDiscountAmount(bc.billDiscount);
        entry.setCashDiscountType(cashDiscount.signum() > 0 ? adjustmentType(req.getCashDiscountType()) : null);
        entry.setCashDiscountValue(cashDiscount.signum() > 0 ? req.getCashDiscountValue().setScale(2, HU) : BigDecimal.ZERO);
        entry.setCashDiscountAmount(cashDiscount);
        entry.setFreightAmount(bc.freight);
        entry.setRoundOffAmount(roundOff);
        entry.setSupplierInvoiceTotal(req.getSupplierInvoiceTotal() != null ? req.getSupplierInvoiceTotal().setScale(2, HU) : null);
        entry.setTotalAmount(totalAmount);
        entry.setTotalTaxable(totalTaxable);
        entry.setTotalCgst(totalCgst);
        entry.setTotalSgst(totalCgst);
        PurchaseEntry saved = purchaseEntryRepository.save(entry);
        // Saving hands back managed copies of the new lines; batches link to those copies.
        for (StockBatch b : newBatches) {
            saved.getItems().stream()
                    .filter(it -> b.getBatchNumber().equals(it.getBatchNumber()))
                    .findFirst()
                    .ifPresent(b::setPurchaseItem);
        }

        String performer = userRepository.findById(updatedById).map(User::getFullName).orElse("Unknown");
        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId).entityType("PURCHASE").entityId(saved.getId()).action("UPDATED")
                .description(changes.isEmpty()
                        ? "Purchase entry " + saved.getEntryNumber() + " re-saved (no changes)"
                        : "Updated " + saved.getEntryNumber() + ": " + String.join(", ", changes))
                .performedBy(performer).build());

        return toResponse(saved);
    }

    // Voids an entry entered by mistake in its entirety — only when nothing on it has sold and
    // nothing has been paid against it. Reverses all stock it added; keeps the row (number, items,
    // audit trail) with its financial impact zeroed, rather than deleting it — same convention as
    // the existing goods-return cancellation.
    public PurchaseDtos.PurchaseEntryResponse voidPurchaseEntry(UUID id, UUID tenantId, UUID voidedById) {
        PurchaseEntry entry = purchaseEntryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", id.toString()));

        if ("VOID".equals(entry.getStatus())) {
            throw new BusinessException("Purchase entry " + entry.getEntryNumber() + " is already voided.", "ALREADY_VOID");
        }
        if (entry.getPaidAmount().compareTo(BigDecimal.ZERO) > 0) {
            throw new BusinessException(
                "Cannot void " + entry.getEntryNumber() + " — ₹" + entry.getPaidAmount().toPlainString() +
                " has already been paid against it. Reverse the payment(s) first.", "VOID_HAS_PAYMENTS");
        }
        for (PurchaseItem item : entry.getItems()) {
            StockBatch batch = stockBatchRepository
                    .findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).orElse(null);
            int soldQty = batch != null ? item.getUnits() - batch.getQuantityAvailable() : 0;
            if (soldQty > 0) {
                throw new BusinessException(
                    "Cannot void " + entry.getEntryNumber() + " — " + soldQty + " unit(s) of '" +
                    item.getProduct().getName() + "' are already sold. Remove only the unsold lines instead.",
                    "VOID_HAS_SOLD_ITEMS");
            }
        }

        for (PurchaseItem item : entry.getItems()) {
            StockBatch batch = stockBatchRepository
                    .findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).orElse(null);
            if (batch != null) {
                batch.setQuantityReceived(batch.getQuantityReceived() - item.getUnits());
                batch.setQuantityAvailable(batch.getQuantityAvailable() - item.getUnits());
                batch.setActive(batch.getQuantityAvailable() > 0);
                stockBatchRepository.save(batch);
            }
            Product product = item.getProduct();
            product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) - item.getUnits());
            productRepository.save(product);

            item.setAmount(BigDecimal.ZERO);
            item.setTaxableAmount(BigDecimal.ZERO);
            item.setCgstAmount(BigDecimal.ZERO);
            item.setSgstAmount(BigDecimal.ZERO);
            item.setGstAmount(BigDecimal.ZERO);
        }

        entry.setStatus("VOID");
        entry.setTotalAmount(BigDecimal.ZERO);
        entry.setTotalTaxable(BigDecimal.ZERO);
        entry.setTotalCgst(BigDecimal.ZERO);
        entry.setTotalSgst(BigDecimal.ZERO);
        PurchaseEntry saved = purchaseEntryRepository.save(entry);

        String performer = userRepository.findById(voidedById).map(User::getFullName).orElse("Unknown");
        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId).entityType("PURCHASE").entityId(saved.getId()).action("VOIDED")
                .description("Voided " + saved.getEntryNumber() + " — entered by mistake, nothing sold or paid")
                .performedBy(performer).build());

        return toResponse(saved);
    }

    public PurchaseDtos.StockBatchResponse updateBatchRates(
            UUID batchId, PurchaseDtos.UpdateBatchRatesRequest req, UUID tenantId, UUID userId) {
        StockBatch batch = stockBatchRepository.findById(batchId)
                .filter(b -> b.getTenant().getId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("StockBatch", batchId.toString()));

        if (req.getMinSaleRate().compareTo(req.getMaxSaleRate()) > 0) {
            throw new BusinessException(
                    "Min sale rate (₹" + req.getMinSaleRate() + ") cannot exceed max sale rate (₹" + req.getMaxSaleRate() + ")",
                    "MIN_EXCEEDS_MAX");
        }

        BigDecimal oldMin = batch.getMinSaleRate();
        BigDecimal oldMax = batch.getMaxSaleRate();
        batch.setMinSaleRate(req.getMinSaleRate());
        batch.setMaxSaleRate(req.getMaxSaleRate());

        java.time.LocalDate oldExpiry = batch.getExpiryDate();
        boolean expiryChanged = req.getExpiryDate() != null && !req.getExpiryDate().equals(oldExpiry);
        if (expiryChanged) {
            batch.setExpiryDate(req.getExpiryDate());
        }
        StockBatch saved = stockBatchRepository.save(batch);

        String performer = userRepository.findById(userId).map(User::getFullName).orElse("Unknown");
        boolean ratesChanged = oldMin.compareTo(req.getMinSaleRate()) != 0 || oldMax.compareTo(req.getMaxSaleRate()) != 0;
        if (ratesChanged || !expiryChanged) {
            auditLogRepository.save(AuditLog.builder()
                    .tenantId(tenantId).entityType("STOCK_BATCH").entityId(saved.getId()).action("RATES_UPDATED")
                    .description("Batch " + saved.getBatchNumber() + " sale rates: min ₹" + oldMin + " → ₹" + req.getMinSaleRate()
                            + ", max ₹" + oldMax + " → ₹" + req.getMaxSaleRate())
                    .performedBy(performer).build());
        }
        if (expiryChanged) {
            auditLogRepository.save(AuditLog.builder()
                    .tenantId(tenantId).entityType("STOCK_BATCH").entityId(saved.getId()).action("EXPIRY_UPDATED")
                    .description("Batch " + saved.getBatchNumber() + " expiry date: "
                            + (oldExpiry != null ? oldExpiry : "none") + " → " + req.getExpiryDate())
                    .performedBy(performer).build());
        }

        return toBatchResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PurchaseDtos.AuditLogResponse> getAuditHistory(UUID id, UUID tenantId) {
        purchaseEntryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", id.toString()));
        return auditLogRepository.findByTenantAndEntity(tenantId, "PURCHASE", id)
                .stream().map(l -> {
                    PurchaseDtos.AuditLogResponse r = new PurchaseDtos.AuditLogResponse();
                    r.setId(l.getId());
                    r.setAction(l.getAction());
                    r.setDescription(l.getDescription());
                    r.setPerformedBy(l.getPerformedBy());
                    r.setPerformedAt(l.getPerformedAt());
                    return r;
                }).collect(Collectors.toList());
    }

    public java.util.List<PurchaseDtos.PurchaseEntryResponse> getAllPurchases(UUID tenantId) {
        return purchaseEntryRepository.findAllByTenant(tenantId)
                .stream().map(this::toResponse).collect(java.util.stream.Collectors.toList());
    }

    public Page<PurchaseDtos.PurchaseEntryResponse> listPurchases(
            UUID tenantId, String status, String supplierName, String invoiceNumber, LocalDate from, LocalDate to, Pageable pageable) {
        java.util.List<String> statuses = "ACTIVE".equalsIgnoreCase(status) ? java.util.List.of("ACTIVE")
                : "VOID".equalsIgnoreCase(status) ? java.util.List.of("VOID")
                : java.util.List.of("ACTIVE", "VOID");
        String supplierParam = (supplierName != null && !supplierName.isBlank())
                ? "%" + supplierName.toLowerCase() + "%" : null;
        String invoiceParam = (invoiceNumber != null && !invoiceNumber.isBlank())
                ? "%" + invoiceNumber.toLowerCase() + "%" : null;
        LocalDate fromParam = from != null ? from : LocalDate.of(1900, 1, 1);
        LocalDate toParam   = to   != null ? to   : LocalDate.of(2999, 12, 31);
        return purchaseEntryRepository.findFiltered(tenantId, statuses, supplierParam, invoiceParam, fromParam, toParam, pageable)
                .map(this::toResponse);
    }

    public PurchaseDtos.PurchaseEntryResponse getPurchaseEntry(UUID id, UUID tenantId) {
        PurchaseEntry entry = purchaseEntryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", id.toString()));
        return toResponse(entry);
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PurchaseDtos.StockBatchResponse> getAllBatches(UUID tenantId, String status, String brand, String search, Pageable pageable) {
        LocalDate nearDate = LocalDate.now().plusDays(30);
        String brandParam  = (brand  != null && !brand.isBlank())  ? brand.toLowerCase()              : null;
        String searchParam = (search != null && !search.isBlank()) ? "%" + search.toLowerCase() + "%" : null;
        String s = status == null ? "active" : status;
        org.springframework.data.domain.Page<StockBatch> page = switch (s) {
            case "expired"     -> stockBatchRepository.findExpiredFiltered(tenantId, brandParam, searchParam, pageable);
            case "near-expiry" -> stockBatchRepository.findNearExpiryFiltered(tenantId, nearDate, brandParam, searchParam, pageable);
            default            -> stockBatchRepository.findActiveFiltered(tenantId, brandParam, searchParam, pageable);
        };
        return page.map(this::toBatchResponse);
    }

    @Transactional(readOnly = true)
    public List<PurchaseDtos.StockBatchResponse> getBatchesByProduct(UUID productId, UUID tenantId) {
        return stockBatchRepository.findByTenantAndProduct(tenantId, productId)
                .stream().map(this::toBatchResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PurchaseDtos.NearExpiryAlert> getNearExpiryAlerts(UUID tenantId, int daysAhead) {
        LocalDate alertDate = LocalDate.now().plusDays(daysAhead);
        return stockBatchRepository.findNearExpiry(tenantId, alertDate)
                .stream().map(b -> {
                    PurchaseDtos.NearExpiryAlert alert = new PurchaseDtos.NearExpiryAlert();
                    alert.setBatchId(b.getId());
                    alert.setBatchNumber(b.getBatchNumber());
                    alert.setProduct(toProductInfo(b.getProduct()));
                    alert.setExpiryDate(b.getExpiryDate());
                    long days = b.getExpiryDate().toEpochDay() - LocalDate.now().toEpochDay();
                    alert.setDaysToExpiry((int) days);
                    alert.setQuantityAvailable(b.getQuantityAvailable());
                    return alert;
                }).collect(Collectors.toList());
    }

    private PurchaseDtos.PurchaseEntryResponse toResponse(PurchaseEntry e) {
        PurchaseDtos.PurchaseEntryResponse res = new PurchaseDtos.PurchaseEntryResponse();
        res.setId(e.getId());
        res.setEntryNumber(e.getEntryNumber());
        res.setSupplierName(e.getSupplierName());
        if (e.getSupplier() != null) res.setSupplierId(e.getSupplier().getId());
        res.setPurchaseDate(e.getPurchaseDate());
        res.setInvoiceNumber(e.getInvoiceNumber());
        res.setTotalAmount(e.getTotalAmount());
        res.setTotalTaxable(e.getTotalTaxable());
        res.setTotalCgst(e.getTotalCgst());
        res.setTotalSgst(e.getTotalSgst());
        res.setPaidAmount(e.getPaidAmount());
        res.setItemDiscountTotal(e.getItems().stream().map(i -> zeroIfNull(i.getDiscountAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        res.setBillDiscountType(e.getBillDiscountType());
        res.setBillDiscountValue(e.getBillDiscountValue());
        res.setBillDiscountAmount(e.getBillDiscountAmount());
        res.setCashDiscountType(e.getCashDiscountType());
        res.setCashDiscountValue(e.getCashDiscountValue());
        res.setCashDiscountAmount(e.getCashDiscountAmount());
        res.setFreightAmount(e.getFreightAmount());
        res.setRoundOffAmount(e.getRoundOffAmount());
        res.setSupplierInvoiceTotal(e.getSupplierInvoiceTotal());
        res.setStatus(e.getStatus());
        res.setNotes(e.getNotes());
        res.setCreatedAt(e.getCreatedAt());

        if (e.getCreatedBy() != null) {
            PurchaseDtos.PersonInfo pi = new PurchaseDtos.PersonInfo();
            pi.setId(e.getCreatedBy().getId());
            pi.setFullName(e.getCreatedBy().getFullName());
            res.setCreatedBy(pi);
        }

        UUID tenantId = e.getTenant().getId();
        res.setItems(e.getItems().stream().map(item -> {
            PurchaseDtos.PurchaseItemResponse ir = new PurchaseDtos.PurchaseItemResponse();
            ir.setId(item.getId());
            ir.setProduct(toProductInfo(item.getProduct()));
            ir.setBatchNumber(item.getBatchNumber());
            ir.setMrp(item.getMrp());
            ir.setDiscountAmount(item.getDiscountAmount());
            ir.setDiscountPercent(item.getDiscountPercent());
            ir.setFreeQty(item.getFreeQty());
            ir.setBillDiscountAmount(item.getBillDiscountAmount());
            ir.setFreightAmount(item.getFreightAmount());
            ir.setTaxableAmount(item.getTaxableAmount());
            ir.setGstPercent(item.getGstPercent());
            ir.setCgstPercent(item.getCgstPercent());
            ir.setSgstPercent(item.getSgstPercent());
            ir.setCgstAmount(item.getCgstAmount());
            ir.setSgstAmount(item.getSgstAmount());
            ir.setGstAmount(item.getGstAmount());
            ir.setPurchaseRate(item.getPurchaseRate());
            ir.setMfgDate(item.getMfgDate());
            ir.setExpiryDate(item.getExpiryDate());
            ir.setQuantity(item.getQuantity());
            ir.setAmount(item.getAmount());
            stockBatchRepository.findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).ifPresent(b -> {
                ir.setMinSaleRate(b.getMinSaleRate());
                ir.setMaxSaleRate(b.getMaxSaleRate());
                ir.setQuantityAvailable(b.getQuantityAvailable());
            });
            return ir;
        }).collect(Collectors.toList()));

        return res;
    }

    private PurchaseDtos.StockBatchResponse toBatchResponse(StockBatch b) {
        PurchaseDtos.StockBatchResponse res = new PurchaseDtos.StockBatchResponse();
        res.setId(b.getId());
        res.setProduct(toProductInfo(b.getProduct()));
        res.setBatchNumber(b.getBatchNumber());
        res.setMrp(b.getMrp());
        res.setPurchaseRate(b.getPurchaseRate());
        res.setMinSaleRate(b.getMinSaleRate());
        res.setMaxSaleRate(b.getMaxSaleRate());
        res.setMfgDate(b.getMfgDate());
        res.setExpiryDate(b.getExpiryDate());
        res.setQuantityReceived(b.getQuantityReceived());
        res.setQuantityAvailable(b.getQuantityAvailable());
        res.setReceivedDate(b.getReceivedDate());
        res.setActive(b.isActive());
        res.setCreatedAt(b.getCreatedAt());
        if (b.getPurchaseItem() != null) {
            PurchaseEntry pe = b.getPurchaseItem().getPurchaseEntry();
            if (pe != null) {
                res.setPurchaseEntryNumber(pe.getEntryNumber());
                res.setSupplierName(pe.getSupplierName());
                if (pe.getSupplier() != null) {
                    res.setSupplierId(pe.getSupplier().getId());
                }
            }
        }
        if (b.getExpiryDate() != null) {
            long days = b.getExpiryDate().toEpochDay() - LocalDate.now().toEpochDay();
            res.setExpired(days < 0);
            res.setNearExpiry(days >= 0 && days <= 30);
        }
        return res;
    }

    private PurchaseDtos.ProductInfo toProductInfo(Product p) {
        PurchaseDtos.ProductInfo pi = new PurchaseDtos.ProductInfo();
        pi.setId(p.getId());
        pi.setName(p.getName());
        pi.setBrand(p.getBrand());
        pi.setUnit(p.getUnit());
        pi.setHsnCode(p.getHsnCode());
        pi.setImageUrl(p.getImageUrl());
        return pi;
    }
}
